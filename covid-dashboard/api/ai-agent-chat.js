const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { runAzureWhoAssistantsChat } = require('./azure-who-assistants');
const { shouldForceWhoRawLookup, isDataAccessDenial } = require('./who-query-predicates');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WHO_FILE_TTL_MS = 40 * 60 * 60 * 1000;
const WHO_CSV_SOURCE_URL = 'https://raw.githubusercontent.com/kyleyoonjh/pandemic_tracker/main/covid-dashboard/csv/WHO-COVID-19-global-data.csv';
const SYSTEM_PROMPT = `당신은 2024-2026년 팬데믹 데이터 분석 전문가입니다.
항상 CSV 데이터 구조를 기반으로 답변하며,
전문 용어를 사용하되 친절하게 설명하세요.
코로나 확진·사망·신규 건수 등 숫자를 묻는 질문은 반드시 이 서비스가 참조하는 WHO CSV(업로드·who_raw 요약 등)에서 도출된 값만 근거로 삼고, CSV에 없는 수치는 추측하거나 임의로 만들지 마세요.
코로나/covid 관련 질문에서는 누적 확진/사망 및 28일 신규 수치를 항목별로 나열하지 말고, 추세와 해석 중심의 서술형으로 답변하세요.`;
const KOREA_REFERENCE_URL = 'https://dportal.kdca.go.kr/pot/bbs/BD_selectBbs.do?q_bbsSn=1025';
const KOREA_KEYWORDS = ['한국', '대한민국', 'korea', 'korean', 'kr'];
let preferredAiProvider = 'groq';
let whoRawSummaryCache = null;
let countryFileIndexCache = null;
let cachedWhoFileRef = {
  name: '',
  uri: '',
  mimeType: 'text/csv',
  uploadedAt: 0
};

const isWhoFileFresh = () => {
  return Boolean(cachedWhoFileRef?.uri) && Date.now() - Number(cachedWhoFileRef?.uploadedAt || 0) < WHO_FILE_TTL_MS;
};

const toNumber = (value) => {
  const normalized = String(value ?? '')
    .replace(/[\u00A0\s]/g, '')
    .replace(/"/g, '')
    .replace(/,/g, '')
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
};

const getWhoRawSummary = () => {
  try {
    const filePath = path.resolve(__dirname, '../public/csv/who_raw');
    const stat = fs.statSync(filePath);
    const mtimeMs = Number(stat.mtimeMs || 0);
    if (whoRawSummaryCache && whoRawSummaryCache.mtimeMs === mtimeMs) return whoRawSummaryCache.summary;

    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return null;
    const header = parseCsvLine(lines[0]).map((s) => String(s).trim());
    const idxDate = header.indexOf('Date_reported');
    const idxCode = header.indexOf('Country_code');
    const idxNewCases = header.indexOf('New_cases');
    const idxNewDeaths = header.indexOf('New_deaths');
    const idxCumCases = header.indexOf('Cumulative_cases');
    const idxCumDeaths = header.indexOf('Cumulative_deaths');
    if ([idxDate, idxCode, idxNewCases, idxNewDeaths, idxCumCases, idxCumDeaths].some((v) => v < 0)) return null;

    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    const latestDate = rows.reduce((max, row) => {
      const d = String(row[idxDate] || '').trim();
      return d > max ? d : max;
    }, '');
    if (!latestDate) return null;
    const latestObj = new Date(latestDate);
    const fromObj = new Date(latestObj);
    fromObj.setDate(fromObj.getDate() - 27);
    const fromDate = fromObj.toISOString().slice(0, 10);

    let latestCases = 0;
    let latestDeaths = 0;
    let newCases28d = 0;
    let newDeaths28d = 0;
    rows.forEach((row) => {
      const code = String(row[idxCode] || '').trim().toUpperCase();
      if (!code || code === 'OWID_WRL') return;
      const d = String(row[idxDate] || '').trim();
      if (d === latestDate) {
        latestCases += toNumber(row[idxCumCases]);
        latestDeaths += toNumber(row[idxCumDeaths]);
      }
      if (d >= fromDate && d <= latestDate) {
        newCases28d += toNumber(row[idxNewCases]);
        newDeaths28d += toNumber(row[idxNewDeaths]);
      }
    });

    const summary = {
      latestDate,
      fromDate,
      latestCases,
      latestDeaths,
      newCases28d,
      newDeaths28d,
      fileMtimeMs: mtimeMs
    };
    whoRawSummaryCache = { mtimeMs, summary };
    return summary;
  } catch (error) {
    return null;
  }
};

/** 서버가 who_raw에서 합산해 둔 캐시 요약을 모델 컨텍스트에 그대로 넘김 (Groq/OpenAI는 파일 업로드가 없음). */
const formatWhoRawCacheForPrompt = (summary) => {
  if (!summary) return '';
  const mtimeMs = Number(summary.fileMtimeMs || 0);
  const mtimeLine = mtimeMs ? `캐시 갱신(파일 mtime, UTC): ${new Date(mtimeMs).toISOString()}` : '';
  return [
    '--- [서버 who_raw 캐시 — WHO CSV 기준 전세계 합산, 아래 수치만 전역 숫자 근거로 사용] ---',
    '전 세계 누적·28일 합 등을 묻는 답변에서는 아래 수치를 반드시 근거로 인용·서술하세요. 이 블록에 없는 전역 숫자는 만들지 마세요.',
    `최신 기준일(Date_reported): ${summary.latestDate}`,
    `최근 28일 구간: ${summary.fromDate} ~ ${summary.latestDate}`,
    `전세계 누적 확진(최신일 국가별 합): ${summary.latestCases.toLocaleString('en-US')}`,
    `전세계 누적 사망(최신일 국가별 합): ${summary.latestDeaths.toLocaleString('en-US')}`,
    `최근 28일 신규 확진 합: ${summary.newCases28d.toLocaleString('en-US')}`,
    `최근 28일 신규 사망 합: ${summary.newDeaths28d.toLocaleString('en-US')}`,
    mtimeLine,
    '국가별 값은 이 블록에 없음 — 특정 국가 숫자는 동일 CSV 원본(또는 Gemini 업로드 파일)에서 확인.'
  ].filter(Boolean).join('\n');
};

const getCountryFileIndex = () => {
  try {
    const dirPath = path.resolve(__dirname, '../public/csv/countries');
    const stat = fs.statSync(dirPath);
    const mtimeMs = Number(stat.mtimeMs || 0);
    if (countryFileIndexCache && countryFileIndexCache.mtimeMs === mtimeMs) return countryFileIndexCache.items;
    const files = fs.readdirSync(dirPath).filter((name) => name.toLowerCase().endsWith('.csv'));
    const items = files.map((name) => {
      const base = name.replace(/\.csv$/i, '');
      const underscore = base.indexOf('_');
      const code = (underscore > 0 ? base.slice(0, underscore) : '').toUpperCase();
      const countryText = (underscore > 0 ? base.slice(underscore + 1) : base).replace(/_/g, ' ').toLowerCase();
      return { name, path: path.join(dirPath, name), code, countryText };
    });
    countryFileIndexCache = { mtimeMs, items };
    return items;
  } catch (error) {
    return [];
  }
};

const resolveCountryFileFromMessages = (safeMessages) => {
  const query = safeMessages.map((m) => String(m.content || '')).join(' ').toLowerCase();
  if (!query) return null;
  const items = getCountryFileIndex();
  if (query.includes('한국') || query.includes('대한민국') || query.includes('korea')) {
    const kr = items.find((i) => i.code === 'KR');
    if (kr) return kr;
  }
  for (const item of items) {
    if (item.countryText && query.includes(item.countryText)) return item;
    if (item.code && query.includes(` ${item.code.toLowerCase()} `)) return item;
  }
  return null;
};

const shouldUseKoreaReference = (safeMessages) => {
  const latestUserMessage = [...safeMessages].reverse().find((m) => m.role === 'user');
  const query = ` ${String(latestUserMessage?.content || '').toLowerCase()} `;
  return KOREA_KEYWORDS.some((keyword) => query.includes(` ${keyword} `) || query.includes(keyword));
};

const normalizeRequestedProvider = (rawValue) => {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('groq') || value.includes('llama')) return 'groq';
  if (value.includes('gemini')) return 'gemini';
  if (value.includes('azure')) return 'azure-openai';
  if (value.includes('openai') || value.includes('gpt')) return 'openai';
  return '';
};

const normalizeCovidAnswerStyle = (text, forceWhoRawLookup) => {
  const raw = String(text || '').trim();
  if (!forceWhoRawLookup || !raw) return raw;
  const filtered = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/[0-9][0-9,.\s]*/.test(line) && /(누적|신규|28일|last 28|new cases|new deaths|cumulative)/i.test(line)) {
        return false;
      }
      if (/^\*\s*\*\*.*\d/.test(line)) return false;
      return true;
    });
  const normalized = filtered.join('\n').trim();
  if (normalized.length >= 40) return normalized;
  return '최근 코로나 동향은 전반적으로 안정적이지만 지역별 변동 가능성이 있어, 추세와 위험 신호를 함께 보며 지속적으로 모니터링하는 것이 중요합니다.';
};

const appendKoreaReferenceLink = (text, useKoreaReference) => {
  const answer = String(text || '').trim();
  if (!useKoreaReference) return answer;
  if (answer.includes(KOREA_REFERENCE_URL)) return answer;
  return `${answer}\n\n참고: ${KOREA_REFERENCE_URL}`;
};

const appendCsvEvidence = (text, useCsvPriority, whoRawSummary) => {
  const answer = String(text || '').trim();
  if (!useCsvPriority || !whoRawSummary) return answer;
  const canonicalBlock = [
    '[WHO CSV 기준 수치]',
    `- 최신 기준일: ${whoRawSummary.latestDate}`,
    `- 전세계 누적 확진: ${Number(whoRawSummary.latestCases || 0).toLocaleString('en-US')}명`,
    `- 전세계 누적 사망: ${Number(whoRawSummary.latestDeaths || 0).toLocaleString('en-US')}명`,
    `- 최근 28일(${whoRawSummary.fromDate}~${whoRawSummary.latestDate}) 신규 확진: ${Number(whoRawSummary.newCases28d || 0).toLocaleString('en-US')}명`,
    `- 최근 28일 신규 사망: ${Number(whoRawSummary.newDeaths28d || 0).toLocaleString('en-US')}명`
  ].join('\n');
  if (!answer) return canonicalBlock;
  if (answer.includes('[WHO CSV 기준 수치]')) return answer;
  return `${answer}\n\n${canonicalBlock}`;
};

/** who_raw 캐시가 프롬프트에 있으면 모델이 수치를 인용한 답을 유지해야 하므로 스트립하지 않음 */
const stripModelNumericClaims = (text, stripNumericLines) => {
  const raw = String(text || '').trim();
  if (!stripNumericLines || !raw) return raw;
  const cleaned = raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const hasNumber = /[0-9]/.test(line);
      const numericContext = /(누적|신규|확진|사망|기준일|최근 28일|last 28|cumulative|new cases|new deaths|latest date)/i.test(line);
      return !(hasNumber && numericContext);
    })
    .join('\n')
    .trim();
  return cleaned || '';
};

const stripMarkdownTables = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const lines = raw.split('\n');
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return true;
    if (!trimmed.endsWith('|')) return true;
    if (/^\|\s*[-:]+\s*\|/.test(trimmed) || /\|\s*[-:]+\s*\|/.test(trimmed)) return false;
    if (/(변수명|변수값|확진자수|의심환자수|사망자수|기준일)/.test(trimmed)) return false;
    return false;
  });
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const hasNumericEvidence = (text) => {
  const raw = String(text || '');
  if (!/[0-9]/.test(raw)) return false;
  return /(누적|신규|확진|사망|cases|deaths|cumulative|latest)/i.test(raw);
};

const buildCsvGroundedFallbackAnswer = ({ whoRawSummary }) => {
  if (whoRawSummary) {
    return [
      `최신 기준일: ${whoRawSummary.latestDate}`,
      `전세계 누적 확진: ${whoRawSummary.latestCases.toLocaleString()}명, 전세계 누적 사망: ${whoRawSummary.latestDeaths.toLocaleString()}명`,
      `최근 28일(${whoRawSummary.fromDate}~${whoRawSummary.latestDate}) 신규 확진: ${whoRawSummary.newCases28d.toLocaleString()}명, 신규 사망: ${whoRawSummary.newDeaths28d.toLocaleString()}명`
    ].join('\n');
  }
  return 'who_raw 기반 요약을 생성하지 못했습니다.';
};

const getCountrySummary = (countryFile) => {
  try {
    if (!countryFile) return null;
    const raw = fs.readFileSync(countryFile.path, 'utf8').replace(/^\uFEFF/, '').trim();
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return null;
    const header = parseCsvLine(lines[0]).map((s) => String(s).trim());
    const idxDate = header.indexOf('Date_reported');
    const idxNewCases = header.indexOf('New_cases');
    const idxNewDeaths = header.indexOf('New_deaths');
    const idxCumCases = header.indexOf('Cumulative_cases');
    const idxCumDeaths = header.indexOf('Cumulative_deaths');
    if ([idxDate, idxNewCases, idxNewDeaths, idxCumCases, idxCumDeaths].some((v) => v < 0)) return null;
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    const latestDate = rows.reduce((max, row) => {
      const d = String(row[idxDate] || '').trim();
      return d > max ? d : max;
    }, '');
    if (!latestDate) return null;
    const latestObj = new Date(latestDate);
    const fromObj = new Date(latestObj);
    fromObj.setDate(fromObj.getDate() - 27);
    const fromDate = fromObj.toISOString().slice(0, 10);
    let latestCases = 0;
    let latestDeaths = 0;
    let newCases28d = 0;
    let newDeaths28d = 0;
    rows.forEach((row) => {
      const d = String(row[idxDate] || '').trim();
      if (d === latestDate) {
        latestCases = toNumber(row[idxCumCases]);
        latestDeaths = toNumber(row[idxCumDeaths]);
      }
      if (d >= fromDate && d <= latestDate) {
        newCases28d += toNumber(row[idxNewCases]);
        newDeaths28d += toNumber(row[idxNewDeaths]);
      }
    });
    return {
      latestDate,
      fromDate,
      latestCases,
      latestDeaths,
      newCases28d,
      newDeaths28d,
      fileName: countryFile.name
    };
  } catch (error) {
    return null;
  }
};

const waitUntilWhoFileActive = async ({ apiKey, fileName, requestTimeoutMs }) => {
  for (let i = 0; i < 20; i += 1) {
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
      params: { key: apiKey },
      timeout: requestTimeoutMs
    });
    const fileInfo = response?.data || {};
    const state = String(fileInfo?.state || fileInfo?.state?.name || '').toUpperCase();
    if (!state || state === 'ACTIVE') return fileInfo;
    if (state === 'FAILED') throw new Error('Gemini File API processing failed.');
    await sleep(500);
  }
  throw new Error('Gemini File API processing timed out.');
};

const ensureWhoFileUploaded = async ({ apiKey, requestTimeoutMs }) => {
  if (isWhoFileFresh()) return cachedWhoFileRef;

  const csvResponse = await axios.get(WHO_CSV_SOURCE_URL, {
    responseType: 'arraybuffer',
    timeout: requestTimeoutMs
  });
  const csvBuffer = Buffer.from(csvResponse.data || []);
  if (!csvBuffer.length) {
    throw new Error('WHO CSV download returned empty content.');
  }
  const startResponse = await axios.post(
    'https://generativelanguage.googleapis.com/upload/v1beta/files',
    { file: { display_name: 'WHO-COVID-19-global-data.csv' } },
    {
      params: { key: apiKey },
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(csvBuffer.length),
        'X-Goog-Upload-Header-Content-Type': 'text/csv'
      },
      timeout: requestTimeoutMs
    }
  );
  const uploadUrl = startResponse?.headers?.['x-goog-upload-url'];
  if (!uploadUrl) throw new Error('Failed to get Gemini upload URL.');
  const uploadResponse = await axios.post(uploadUrl, csvBuffer, {
    headers: {
      'Content-Type': 'text/csv',
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    timeout: requestTimeoutMs
  });
  const uploadedFile = uploadResponse?.data?.file || uploadResponse?.data || {};
  const fileName = String(uploadedFile?.name || '');
  if (!fileName) throw new Error('Gemini upload did not return file name.');
  const activeFile = await waitUntilWhoFileActive({ apiKey, fileName, requestTimeoutMs });
  cachedWhoFileRef = {
    name: String(activeFile?.name || fileName),
    uri: String(activeFile?.uri || uploadedFile?.uri || ''),
    mimeType: String(activeFile?.mimeType || uploadedFile?.mimeType || 'text/csv'),
    uploadedAt: Date.now()
  };
  if (!cachedWhoFileRef.uri) throw new Error('Gemini file URI missing after upload.');
  return cachedWhoFileRef;
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = incomingMessages
      .filter((msg) => msg && typeof msg.content === 'string')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content
      }))
      .slice(-16);

    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const openAiApiKey = process.env.OPENAI_API_KEY;
    const openAiModel = process.env.OPENAI_MODEL || 'gpt-4o';
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureEndpoint = String(process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/$/, '');
    const azureDeployment = String(process.env.AZURE_OPENAI_DEPLOYMENT || '').trim();
    const azureApiVersion = String(process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview').trim();
    const azureUseFileSearch = String(process.env.AZURE_OPENAI_FILE_SEARCH || 'true').toLowerCase() !== 'false';
    const azureChatUrl = azureEndpoint && azureDeployment
      ? `${azureEndpoint}/openai/deployments/${encodeURIComponent(azureDeployment)}/chat/completions?api-version=${encodeURIComponent(azureApiVersion)}`
      : '';
    const requestedProvider = normalizeRequestedProvider(req.body?.requestedProvider);
    const requestTimeoutMs = Math.max(2000, Number(process.env.GEMINI_TIMEOUT_MS || 10000));
    const enableWebSearch = String(process.env.GEMINI_ENABLE_WEB_SEARCH || 'true').toLowerCase() !== 'false';
    if (requestedProvider === 'groq' && !groqApiKey) {
      res.status(400).json({ error: 'Requested provider groq is not configured.' });
      return;
    }
    if (requestedProvider === 'gemini' && !geminiApiKey) {
      res.status(400).json({ error: 'Requested provider gemini is not configured.' });
      return;
    }
    if (requestedProvider === 'openai' && !openAiApiKey) {
      res.status(400).json({ error: 'Requested provider openai is not configured.' });
      return;
    }
    if (requestedProvider === 'azure-openai' && (!azureApiKey || !azureEndpoint || !azureDeployment)) {
      const missingAzure = [
        !azureApiKey && 'AZURE_OPENAI_API_KEY',
        !azureEndpoint && 'AZURE_OPENAI_ENDPOINT',
        !azureDeployment && 'AZURE_OPENAI_DEPLOYMENT'
      ].filter(Boolean);
      res.status(400).json({
        error: `Azure OpenAI is not configured. Add to .env (restart npm after saving): ${missingAzure.join(', ') || 'AZURE_OPENAI_*'}. Deployment name must match your Azure portal model deployment.`
      });
      return;
    }
    if (requestedProvider === 'azure-openai' && !azureUseFileSearch && !azureChatUrl) {
      res.status(400).json({ error: 'Azure chat completions URL could not be built. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT.' });
      return;
    }
    const providers = requestedProvider
      ? [requestedProvider]
      : Array.from(new Set([preferredAiProvider, 'groq', 'gemini', 'openai', 'azure-openai']));
    const errors = [];
    const forceWhoRawLookup = shouldForceWhoRawLookup(safeMessages);
    const useKoreaReference = shouldUseKoreaReference(safeMessages);
    const useCsvPriority = forceWhoRawLookup;
    const useKoreaReferenceLink = false;
    const koreaReferenceText = '';
    const whoRawSummary = useCsvPriority ? getWhoRawSummary() : null;
    const countrySummary = null;
    const csvPriorityText = useCsvPriority
      ? [
          '중요: 한국 이외 코로나 질의는 반드시 로컬 CSV를 1순위 근거로 사용하세요.',
          whoRawSummary ? formatWhoRawCacheForPrompt(whoRawSummary) : 'who_raw 요약 캐시를 계산하지 못했습니다. 전역 수치 언급은 삼가세요.',
          '국가별 CSV 파일은 사용하지 말고 who_raw만 기준으로 설명하세요.',
          whoRawSummary
            ? '캐시에 제시된 전역 수치는 답변에서 인용·근거로 사용해도 됩니다. 나열이 아닌 문장으로 풀어쓰기만 하면 됩니다.'
            : '숫자 나열보다 변화 방향, 지역별 차이, 해석을 중심으로 서술하세요.'
        ].join('\n')
      : '';
    const stripAnswerNumericLines = useCsvPriority && !whoRawSummary;

    for (const provider of providers) {
      try {
        if (provider === 'groq' && groqApiKey) {
          const groqMessages = [
            { role: 'system', content: `${SYSTEM_PROMPT}\n가능하면 최신 공개 정보를 반영해 답변하세요.\n${koreaReferenceText}\n${csvPriorityText}`.trim() },
            ...safeMessages
          ];
          const groqResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { model: groqModel, messages: groqMessages, temperature: 0.3 },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${groqApiKey}`
              },
              timeout: requestTimeoutMs
            }
          );
          const answer = String(groqResponse?.data?.choices?.[0]?.message?.content || '').trim();
          if (answer) {
            preferredAiProvider = 'groq';
            const resolvedAnswer = forceWhoRawLookup && isDataAccessDenial(answer)
              ? '요청하신 데이터 파일을 바탕으로 분석 중입니다. 질문을 조금 더 구체화해 주시면 추세 중심으로 답변드리겠습니다.'
              : (useCsvPriority ? answer : normalizeCovidAnswerStyle(answer, forceWhoRawLookup));
            const finalAnswer = appendKoreaReferenceLink(
              appendCsvEvidence(
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, stripAnswerNumericLines)),
                useCsvPriority,
                whoRawSummary
              ),
              useKoreaReferenceLink
            );
            res.status(200).json({ answer: finalAnswer, provider: 'groq-llama4-scout' });
            return;
          }
          throw new Error('Groq returned empty answer');
        }

        if (provider === 'gemini' && geminiApiKey) {
          const normalized = String(geminiModel).replace(/^models\//, '');
          const candidateModels = [normalized, 'gemini-flash-latest']
            .filter((value, index, self) => value && self.indexOf(value) === index);
          const maxModelAttempts = Math.max(1, Number(process.env.GEMINI_MAX_MODEL_ATTEMPTS || 2));
          const modelCandidates = candidateModels.slice(0, maxModelAttempts);
          const whoFileRef = await ensureWhoFileUploaded({ apiKey: geminiApiKey, requestTimeoutMs });
          const contents = [
            {
              role: 'user',
              parts: [
                { text: `답변 시 업로드된 WHO CSV 원본을 우선 근거로 사용하세요. ${koreaReferenceText} ${csvPriorityText}`.trim() },
                { file_data: { mime_type: whoFileRef.mimeType, file_uri: whoFileRef.uri } }
              ]
            },
            ...safeMessages.map((msg) => ({
              role: msg.role === 'assistant' ? 'model' : msg.role,
              parts: [{ text: msg.content }]
            }))
          ];
          const payload = {
            systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n${koreaReferenceText}\n${csvPriorityText}`.trim() }] },
            generationConfig: { temperature: 0.3 },
            ...(enableWebSearch ? { tools: [{ google_search: {} }] } : {}),
            contents
          };
          let data = null;
          let lastGeminiErr = null;
          for (const model of modelCandidates) {
            try {
              const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                payload,
                {
                  headers: { 'Content-Type': 'application/json' },
                  params: { key: geminiApiKey },
                  timeout: requestTimeoutMs
                }
              );
              data = response.data;
              break;
            } catch (err) {
              lastGeminiErr = err;
            }
          }
          const answer = String((data?.candidates?.[0]?.content?.parts || []).map((p) => String(p?.text || '')).join('\n')).trim();
          if (answer) {
            preferredAiProvider = 'gemini';
            const resolvedAnswer = forceWhoRawLookup && isDataAccessDenial(answer)
              ? '요청하신 데이터 파일을 바탕으로 분석 중입니다. 질문을 조금 더 구체화해 주시면 추세 중심으로 답변드리겠습니다.'
              : (useCsvPriority ? answer : normalizeCovidAnswerStyle(answer, forceWhoRawLookup));
            const finalAnswer = appendKoreaReferenceLink(
              appendCsvEvidence(
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, stripAnswerNumericLines)),
                useCsvPriority,
                whoRawSummary
              ),
              useKoreaReferenceLink
            );
            res.status(200).json({ answer: finalAnswer, provider: 'gemini' });
            return;
          }
          throw lastGeminiErr || new Error('Gemini returned empty answer');
        }

        if (provider === 'openai' && openAiApiKey) {
          const openAiMessages = [{ role: 'system', content: `${SYSTEM_PROMPT}\n${koreaReferenceText}\n${csvPriorityText}`.trim() }, ...safeMessages];
          const openAiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            { model: openAiModel, messages: openAiMessages, temperature: 0.3 },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openAiApiKey}`
              },
              timeout: requestTimeoutMs
            }
          );
          const answer = String(openAiResponse?.data?.choices?.[0]?.message?.content || '').trim();
          if (answer) {
            preferredAiProvider = 'openai';
            const resolvedAnswer = forceWhoRawLookup && isDataAccessDenial(answer)
              ? '요청하신 데이터 파일을 바탕으로 분석 중입니다. 질문을 조금 더 구체화해 주시면 추세 중심으로 답변드리겠습니다.'
              : (useCsvPriority ? answer : normalizeCovidAnswerStyle(answer, forceWhoRawLookup));
            const finalAnswer = appendKoreaReferenceLink(
              appendCsvEvidence(
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, stripAnswerNumericLines)),
                useCsvPriority,
                whoRawSummary
              ),
              useKoreaReferenceLink
            );
            res.status(200).json({ answer: finalAnswer, provider: 'openai-fallback' });
            return;
          }
          throw new Error('OpenAI returned empty answer');
        }

        if (provider === 'azure-openai' && azureApiKey && azureEndpoint && azureDeployment) {
          const systemBlock = `${SYSTEM_PROMPT}\n${koreaReferenceText}\n${csvPriorityText}`.trim();
          let answer = '';
          let usedAzureAssistants = false;

          if (azureUseFileSearch) {
            try {
              const assistantInstructions = `${systemBlock}

[Azure file_search — 필수]
• 이미 이 어시스턴트에 WHO 글로벌 CSV가 벡터 스토어로 연결되어 있습니다(파일 표시명: WHO-COVID-19-global-data.csv). 사용자가 who.txt라고 불러도 같은 데이터입니다.
• 반드시 file_search로 해당 파일에서 검색한 뒤 답하세요. 세션에 파일이 “안 보인다”, “업로드해 달라”, “내용을 붙여 달라”고 말하면 안 됩니다 — 데이터는 이미 검색 가능합니다.
• 열: Date_reported, Country_code, Country_name, WHO_region, New_cases, Cumulative_cases, New_deaths, Cumulative_deaths 등. CSV에 없는 수치는 추측하지 마세요.`.trim();
              answer = await runAzureWhoAssistantsChat({
                endpoint: azureEndpoint,
                apiKey: azureApiKey,
                apiVersion: azureApiVersion,
                deploymentName: azureDeployment,
                fullInstructions: assistantInstructions,
                safeMessages,
                timeoutMs: requestTimeoutMs
              });
              if (answer) {
                usedAzureAssistants = true;
              }
            } catch (assistErr) {
              errors.push({
                provider: 'azure-openai-assistants',
                error: assistErr?.message || String(assistErr)
              });
            }
          }

          if (!answer && azureChatUrl) {
            const azureMessages = [{ role: 'system', content: systemBlock }, ...safeMessages];
            let azureResponse;
            try {
              azureResponse = await axios.post(
                azureChatUrl,
                { messages: azureMessages, temperature: 0.3 },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'api-key': azureApiKey
                  },
                  timeout: requestTimeoutMs
                }
              );
            } catch (azureErr) {
              const status = azureErr?.response?.status;
              const payload = azureErr?.response?.data;
              const inner = payload?.error?.error || payload?.error;
              const code = inner?.code || payload?.error?.code;
              if (code === 'DeploymentNotFound' || status === 404) {
                throw new Error(
                  'Azure DeploymentNotFound: 리소스에 해당 배포가 없습니다. Azure Portal → 해당 Azure OpenAI 리소스 → Studio → Deployments에서 배포 이름을 확인하고, covid-dashboard/.env의 AZURE_OPENAI_DEPLOYMENT 값을 그 이름과 완전히 동일하게 수정한 뒤 npm을 재시작하세요. (현재 기본값 gpt-4o가 포털 배포명과 다를 수 있습니다.)'
                );
              }
              throw azureErr;
            }
            answer = String(azureResponse?.data?.choices?.[0]?.message?.content || '').trim();
          }

          if (answer) {
            preferredAiProvider = 'azure-openai';
            const resolvedAnswer = forceWhoRawLookup && isDataAccessDenial(answer)
              ? '요청하신 데이터 파일을 바탕으로 분석 중입니다. 질문을 조금 더 구체화해 주시면 추세 중심으로 답변드리겠습니다.'
              : (useCsvPriority ? answer : normalizeCovidAnswerStyle(answer, forceWhoRawLookup));
            const finalAnswer = appendKoreaReferenceLink(
              appendCsvEvidence(
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, stripAnswerNumericLines)),
                useCsvPriority,
                whoRawSummary
              ),
              useKoreaReferenceLink
            );
            res.status(200).json({
              answer: finalAnswer,
              provider: usedAzureAssistants ? 'azure-openai-assistants' : 'azure-openai'
            });
            return;
          }
          throw new Error('Azure OpenAI returned empty answer');
        }
      } catch (error) {
        errors.push({ provider, error: error?.response?.data || error?.message || 'unknown error' });
      }
    }

    res.status(500).json({
      error: `All providers failed: ${JSON.stringify(errors)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'AI agent request failed.' });
  }
};
