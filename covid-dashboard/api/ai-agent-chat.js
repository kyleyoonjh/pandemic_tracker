const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WHO_FILE_TTL_MS = 40 * 60 * 60 * 1000;
const WHO_CSV_SOURCE_URL = 'https://raw.githubusercontent.com/kyleyoonjh/pandemic_tracker/main/covid-dashboard/csv/WHO-COVID-19-global-data.csv';
const SYSTEM_PROMPT = `당신은 2024-2026년 팬데믹 데이터 분석 전문가입니다.
항상 CSV 데이터 구조를 기반으로 답변하며,
전문 용어를 사용하되 친절하게 설명하세요.
코로나/covid 관련 질문에서는 누적 확진/사망 및 28일 신규 수치를 항목별로 나열하지 말고, 추세와 해석 중심의 서술형으로 답변하세요.`;
const COVID_KEYWORDS = ['covid', '코로나', '팬데믹', '확진', '사망', '누적 확진', '누적 사망', 'sars-cov-2'];
const NON_COVID_TOPICS = ['백일해', 'pertussis'];
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
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
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
      newDeaths28d
    };
    whoRawSummaryCache = { mtimeMs, summary };
    return summary;
  } catch (error) {
    return null;
  }
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

const shouldForceWhoRawLookup = (safeMessages) => {
  const latestUserMessage = [...safeMessages].reverse().find((m) => m.role === 'user');
  const query = String(latestUserMessage?.content || '').toLowerCase();
  const switchingAwayFromCovid = /코로나\s*말고|covid\s*말고|not\s+covid|instead of covid/i.test(query)
    || NON_COVID_TOPICS.some((topic) => query.includes(topic));
  if (switchingAwayFromCovid) return false;
  return COVID_KEYWORDS.some((keyword) => query.includes(keyword));
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
  if (value.includes('openai') || value.includes('gpt')) return 'openai';
  return '';
};

const isDataAccessDenial = (text) => {
  const lowered = String(text || '').toLowerCase();
  return (
    lowered.includes('cannot access') ||
    lowered.includes('i do not have access') ||
    lowered.includes('i can\'t access') ||
    lowered.includes('접근할 수 없') ||
    lowered.includes('접근할수없') ||
    lowered.includes('실제 데이터를 제공할 수 없') ||
    lowered.includes('데이터셋에 접근할 수 없')
  );
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
  return answer;
};

const stripModelNumericClaims = (text, useCsvPriority) => {
  const raw = String(text || '').trim();
  if (!useCsvPriority || !raw) return raw;
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
    const providers = requestedProvider
      ? [requestedProvider]
      : Array.from(new Set([preferredAiProvider, 'groq', 'gemini', 'openai']));
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
          whoRawSummary
            ? `who_raw 최신기준일=${whoRawSummary.latestDate}, 최근28일구간=${whoRawSummary.fromDate}~${whoRawSummary.latestDate}, 전세계 누적/28일 지표가 계산되어 있습니다.`
            : 'who_raw 요약 계산값을 우선 참조하세요.',
          '국가별 CSV 파일은 사용하지 말고 who_raw만 기준으로 설명하세요.',
          '숫자 나열보다 변화 방향, 지역별 차이, 해석을 중심으로 서술하세요.'
        ].join('\n')
      : '';

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
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, useCsvPriority)),
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
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, useCsvPriority)),
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
                stripMarkdownTables(stripModelNumericClaims(resolvedAnswer, useCsvPriority)),
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
