// src/api/service.js
import axios from 'axios';
import { ENDPOINTS } from '../constants/apiEndpoints';

// Create axios instance with default configurations
const apiClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const KR_POPULATION = 51329899;
const DEFAULT_USE_WHO_GLOBAL = true;
const DEFAULT_USE_DISEASE_FALLBACK = true;
const WHO_GLOBAL_TIMEOUT_MS = 4000;
const KR_API_TIMEOUT_MS = 4000;
const DEFAULT_USE_KR_API = false;
const KR_COUNTRY_INFO = {
  _id: 410,
  iso2: 'KR',
  iso3: 'KOR',
  lat: 37,
  long: 127.5,
  flag: 'https://disease.sh/assets/img/flags/kr.png'
};

const parseBooleanEnv = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeKrDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
};

const keepLatestByRegion = (rows = []) => {
  const latestMap = new Map();
  rows.forEach((row) => {
    const region = String(row?.region || '').trim();
    if (!region || region === '합계' || region === '검역') return;
    const sourceDate = normalizeKrDate(row?.sourceDate);
    if (!sourceDate) return;
    const prev = latestMap.get(region);
    if (!prev || sourceDate > prev.sourceDate) {
      latestMap.set(region, { ...row, sourceDate });
    }
  });
  return Array.from(latestMap.values());
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
};

const parseWhoGlobalCsv = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return null;
  const trimmed = csvText.trim().replace(/^\uFEFF/, '');
  if (!trimmed || trimmed.startsWith('<!DOCTYPE html')) return null;

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;

  const header = parseCsvLine(lines[0]).map((h) => String(h || '').trim());
  const idxDate = header.indexOf('Date_reported');
  const idxCode = header.indexOf('Country_code');
  const idxNewCases = header.indexOf('New_cases');
  const idxCumCases = header.indexOf('Cumulative_cases');
  const idxNewDeaths = header.indexOf('New_deaths');
  const idxCumDeaths = header.indexOf('Cumulative_deaths');
  if ([idxDate, idxCode, idxNewCases, idxCumCases, idxNewDeaths, idxCumDeaths].some((idx) => idx < 0)) return null;

  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  const latestDate = rows.reduce((maxDate, row) => {
    const date = String(row[idxDate] || '').trim();
    return date > maxDate ? date : maxDate;
  }, '');
  if (!latestDate) return null;

  const latestRows = rows.filter((row) => String(row[idxDate] || '').trim() === latestDate);
  const countryRows = latestRows.filter((row) => String(row[idxCode] || '').trim() && String(row[idxCode] || '').trim() !== 'OWID_WRL');
  if (countryRows.length === 0) return null;

  let totalCases = 0;
  let totalDeaths = 0;
  let totalNewCases = 0;
  let totalNewDeaths = 0;
  countryRows.forEach((row) => {
    totalCases += toNumber(row[idxCumCases]);
    totalDeaths += toNumber(row[idxCumDeaths]);
    totalNewCases += toNumber(row[idxNewCases]);
    totalNewDeaths += toNumber(row[idxNewDeaths]);
  });

  return {
    updated: Date.now(),
    cases: totalCases,
    todayCases: totalNewCases,
    deaths: totalDeaths,
    todayDeaths: totalNewDeaths,
    recovered: 0,
    todayRecovered: 0,
    active: Math.max(0, totalCases - totalDeaths),
    critical: 0,
    tests: 0,
    population: 0,
    source: 'who-csv',
    sourceDate: latestDate
  };
};

const parseKrCovidXml = (xmlText) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const items = Array.from(xmlDoc.getElementsByTagName('item'));

  const rows = items.map((item) => {
    const getText = (tagName) => item.getElementsByTagName(tagName)?.[0]?.textContent ?? '';
    const decideCnt = toNumber(getText('decideCnt') || getText('defCnt'));
    const clearCnt = toNumber(getText('clearCnt') || getText('isolClearCnt'));
    const careCnt = toNumber(getText('careCnt') || getText('isolIngCnt'));
    return {
      stateDt: getText('stateDt') || getText('stdDay'),
      decideCnt,
      deathCnt: toNumber(getText('deathCnt')),
      clearCnt,
      careCnt
    };
  }).filter((row) => row.decideCnt > 0);

  rows.sort((a, b) => String(a.stateDt).localeCompare(String(b.stateDt)));
  return rows;
};

const parseKrRegionalXml = (xmlText) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const items = Array.from(xmlDoc.getElementsByTagName('item'));

  const rows = items.map((item) => {
    const getText = (tagName) => item.getElementsByTagName(tagName)?.[0]?.textContent ?? '';
    const regionName = getText('gubun') || getText('gubunNm') || getText('areaNm') || getText('sido') || getText('region');
    return {
      region: regionName,
      confirmed: toNumber(getText('defCnt') || getText('decideCnt') || getText('confirmed')),
      newConfirmed: toNumber(getText('incDec') || getText('localOccCnt') || getText('newCases')),
      deaths: toNumber(getText('deathCnt') || getText('deaths')),
      sourceDate: getText('stdDay') || getText('stateDt') || getText('date')
    };
  }).filter((row) => row.region);
  return keepLatestByRegion(rows);
};

const parseKrRegionalPayload = (payload) => {
  if (!payload) return [];
  const rawItems =
    payload?.items?.item
    || payload?.response?.body?.items?.item
    || payload?.body?.items?.item
    || payload?.data?.items?.item
    || payload?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  if (process.env.NODE_ENV !== 'production') {
    console.info('[KR regional] JSON payload item count:', items.length);
  }
  const rows = items.map((item) => ({
    region: String(item?.gubun || item?.gubunNm || item?.areaNm || item?.sido || item?.region || '').trim(),
    confirmed: toNumber(item?.defCnt || item?.decideCnt || item?.confirmed),
    newConfirmed: toNumber(item?.incDec || item?.localOccCnt || item?.newCases),
    deaths: toNumber(item?.deathCnt || item?.deaths),
    sourceDate: String(item?.stdDay || item?.stateDt || item?.date || '').trim()
  })).filter((row) => row.region);
  return keepLatestByRegion(rows);
};

const getDateKey = (offsetDays = 0, withDash = false) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (withDash) return `${yyyy}-${mm}-${dd}`;
  return `${yyyy}${mm}${dd}`;
};

const getStdDayCandidates = (offsetDays = 0) => {
  return [getDateKey(offsetDays, true), getDateKey(offsetDays, false)];
};

const LEGACY_KR_FALLBACK_DATES = ['2023-08-31', '20230831'];
const DEFAULT_USE_KR_REGIONAL_MOCK = true;
const KR_REGIONAL_MOCK_XML = `
<response>
  <body>
    <items>
      <item><gubun>서울</gubun><defCnt>6698035</defCnt><incDec>8825</incDec><deathCnt>6649</deathCnt><stdDay>2023-08-23</stdDay></item>
      <item><gubun>부산</gubun><defCnt>1963017</defCnt><incDec>3934</incDec><deathCnt>2881</deathCnt><stdDay>2023-07-20</stdDay></item>
      <item><gubun>대구</gubun><defCnt>1476145</defCnt><incDec>2668</incDec><deathCnt>2051</deathCnt><stdDay>2023-08-10</stdDay></item>
      <item><gubun>인천</gubun><defCnt>1857275</defCnt><incDec>884</incDec><deathCnt>1930</deathCnt><stdDay>2023-06-15</stdDay></item>
      <item><gubun>광주</gubun><defCnt>997048</defCnt><incDec>557</incDec><deathCnt>854</deathCnt><stdDay>2023-08-14</stdDay></item>
      <item><gubun>대전</gubun><defCnt>909928</defCnt><incDec>155</incDec><deathCnt>951</deathCnt><stdDay>2023-05-01</stdDay></item>
      <item><gubun>울산</gubun><defCnt>698215</defCnt><incDec>1242</incDec><deathCnt>540</deathCnt><stdDay>2023-07-21</stdDay></item>
      <item><gubun>세종</gubun><defCnt>269111</defCnt><incDec>392</incDec><deathCnt>58</deathCnt><stdDay>2023-08-16</stdDay></item>
      <item><gubun>경기</gubun><defCnt>8901209</defCnt><incDec>10476</incDec><deathCnt>8538</deathCnt><stdDay>2023-07-28</stdDay></item>
      <item><gubun>강원</gubun><defCnt>984563</defCnt><incDec>647</incDec><deathCnt>1383</deathCnt><stdDay>2023-08-14</stdDay></item>
      <item><gubun>충북</gubun><defCnt>1073338</defCnt><incDec>1705</incDec><deathCnt>1094</deathCnt><stdDay>2023-08-30</stdDay></item>
      <item><gubun>충남</gubun><defCnt>1364723</defCnt><incDec>1854</incDec><deathCnt>1634</deathCnt><stdDay>2023-08-16</stdDay></item>
      <item><gubun>전북</gubun><defCnt>1090547</defCnt><incDec>356</incDec><deathCnt>1252</deathCnt><stdDay>2023-07-17</stdDay></item>
      <item><gubun>전남</gubun><defCnt>1048254</defCnt><incDec>487</incDec><deathCnt>1025</deathCnt><stdDay>2023-06-22</stdDay></item>
      <item><gubun>경북</gubun><defCnt>1457067</defCnt><incDec>738</incDec><deathCnt>2123</deathCnt><stdDay>2023-06-20</stdDay></item>
      <item><gubun>경남</gubun><defCnt>1912833</defCnt><incDec>442</incDec><deathCnt>2003</deathCnt><stdDay>2023-06-26</stdDay></item>
      <item><gubun>제주</gubun><defCnt>414395</defCnt><incDec>382</incDec><deathCnt>298</deathCnt><stdDay>2023-06-29</stdDay></item>
      <item><gubun>검역</gubun><defCnt>17723</defCnt><incDec>5</incDec><deathCnt>16</deathCnt><stdDay>2023-03-25</stdDay></item>
      <item><gubun>합계</gubun><defCnt>33432201</defCnt><incDec>54729</incDec><deathCnt>35374</deathCnt><stdDay>2023-08-04</stdDay></item>
    </items>
  </body>
</response>
`;

const mapKrRowsToCountryShape = (rows, baseCountry = null) => {
  if (!rows || rows.length === 0) return null;

  const latest = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : latest;

  const cases = latest.decideCnt;
  const deaths = latest.deathCnt;
  const recovered = latest.clearCnt;
  const active = latest.careCnt > 0 ? latest.careCnt : Math.max(0, cases - deaths - recovered);

  const todayCases = Math.max(0, latest.decideCnt - previous.decideCnt);
  const todayDeaths = Math.max(0, latest.deathCnt - previous.deathCnt);
  const todayRecovered = Math.max(0, latest.clearCnt - previous.clearCnt);

  return {
    ...(baseCountry || {}),
    country: 'S. Korea',
    countryInfo: KR_COUNTRY_INFO,
    updated: Date.now(),
    cases,
    todayCases,
    deaths,
    todayDeaths,
    recovered,
    todayRecovered,
    active,
    sourceDate: String(latest.stateDt || ''),
    population: KR_POPULATION,
    casesPerOneMillion: (cases / KR_POPULATION) * 1000000,
    deathsPerOneMillion: (deaths / KR_POPULATION) * 1000000,
    recoveredPerOneMillion: (recovered / KR_POPULATION) * 1000000,
    activePerOneMillion: (active / KR_POPULATION) * 1000000
  };
};

const getKrRegionalMockRows = () => {
  return parseKrRegionalXml(KR_REGIONAL_MOCK_XML);
};

const withTimeout = async (promise, timeoutMs, fallbackValue = null) => {
  let timerId;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timerId);
  }
};

const fetchKoreaFromDataGoKr = async () => {
  const useKrApi = parseBooleanEnv(process.env.REACT_APP_USE_KR_API, DEFAULT_USE_KR_API);
  if (!useKrApi) return null;

  const serviceKey = process.env.REACT_APP_DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    return null;
  }

  const endpoint = process.env.REACT_APP_DATA_GO_KR_API_URL
    || 'https://apis.data.go.kr/1352000/ODMS_COVID_04/callCovid04Api';

  const stdDayCandidates = [
    ...LEGACY_KR_FALLBACK_DATES,
    ...getStdDayCandidates(0),
    ...getStdDayCandidates(-1),
    ...getStdDayCandidates(-2)
  ];

  for (let i = 0; i < stdDayCandidates.length; i += 1) {
    const stdDay = stdDayCandidates[i];
    const query = new URLSearchParams({
      serviceKey,
      pageNo: '1',
      numOfRows: '500',
      apiType: 'XML',
      std_day: stdDay,
      gubun: '합계'
    });

    try {
      const response = await axios.get(`${endpoint}?${query.toString()}`, { timeout: KR_API_TIMEOUT_MS });
      const rows = parseKrCovidXml(typeof response.data === 'string' ? response.data : '');
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[KR national] XML rows for std_day=${stdDay}:`, rows.length);
      }
      if (rows.length > 0) return mapKrRowsToCountryShape(rows);
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        console.warn('KR national API unauthorized/forbidden. Skipping data.go.kr integration.');
        return null;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[KR national] request failed for std_day=${stdDay}:`, error.message);
      }
      if (i === stdDayCandidates.length - 1) {
        console.warn('Failed to fetch KR data from data.go.kr, using fallback source:', error.message);
      }
    }
  }
  return null;
};

export const fetchKoreaRegionalData = async () => {
  const useKrRegionalMock = parseBooleanEnv(
    process.env.REACT_APP_USE_KR_REGIONAL_MOCK,
    DEFAULT_USE_KR_REGIONAL_MOCK
  );
  if (useKrRegionalMock) {
    return getKrRegionalMockRows();
  }

  const useKrApi = parseBooleanEnv(process.env.REACT_APP_USE_KR_API, DEFAULT_USE_KR_API);
  if (!useKrApi) return [];

  const serviceKey = process.env.REACT_APP_DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return [];

  const endpoint = process.env.REACT_APP_DATA_GO_KR_API_URL
    || 'https://apis.data.go.kr/1352000/ODMS_COVID_04/callCovid04Api';

  const dayOffsets = [0, -1, -2, -3];
  for (let i = 0; i < dayOffsets.length; i += 1) {
    const offset = dayOffsets[i];
    const stdDayCandidates = [
      ...LEGACY_KR_FALLBACK_DATES,
      ...getStdDayCandidates(offset),
    ];

    for (let j = 0; j < stdDayCandidates.length; j += 1) {
      const stdDay = stdDayCandidates[j];

      const query = new URLSearchParams({
        serviceKey,
        pageNo: '1',
        numOfRows: '500',
        apiType: 'JSON',
        std_day: stdDay
      });

      try {
        const response = await axios.get(`${endpoint}?${query.toString()}`, { timeout: KR_API_TIMEOUT_MS });
        const rows = parseKrRegionalPayload(response.data);
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[KR regional] JSON rows for std_day=${stdDay}:`, rows.length);
        }
        if (rows.length > 0) return rows;
      } catch (jsonError) {
        const jsonStatusCode = jsonError?.response?.status;
        if (jsonStatusCode === 401 || jsonStatusCode === 403) {
          console.warn('KR regional API unauthorized/forbidden. Skipping data.go.kr integration.');
          return [];
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[KR regional] JSON request failed for std_day=${stdDay}:`, jsonError.message);
        }
        // Fallback to XML if JSON response fails for this key/environment.
        try {
          const xmlQuery = new URLSearchParams({
            serviceKey,
            pageNo: '1',
            numOfRows: '500',
            apiType: 'XML',
            std_day: stdDay
          });
          const xmlResponse = await axios.get(`${endpoint}?${xmlQuery.toString()}`, { timeout: KR_API_TIMEOUT_MS });
          const rows = parseKrRegionalXml(typeof xmlResponse.data === 'string' ? xmlResponse.data : '');
          if (process.env.NODE_ENV !== 'production') {
            console.info(`[KR regional] XML rows for std_day=${stdDay}:`, rows.length);
          }
          if (rows.length > 0) return rows;
        } catch (xmlError) {
          const xmlStatusCode = xmlError?.response?.status;
          if (xmlStatusCode === 401 || xmlStatusCode === 403) {
            console.warn('KR regional API unauthorized/forbidden (XML). Skipping data.go.kr integration.');
            return [];
          }
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[KR regional] XML request failed for std_day=${stdDay}:`, xmlError.message);
          }
          const isLastAttempt = i === dayOffsets.length - 1 && j === stdDayCandidates.length - 1;
          if (isLastAttempt) {
            console.warn('Failed to fetch KR regional data from data.go.kr:', xmlError.message);
          }
        }
      }
    }
  }
  return getKrRegionalMockRows();
};

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        endpoint: error.config.url
      });
    } else if (error.request) {
      console.error('API Error Request:', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Global data service
export const fetchGlobalData = async () => {
  try {
    const useWhoGlobal = parseBooleanEnv(process.env.REACT_APP_USE_WHO_GLOBAL, DEFAULT_USE_WHO_GLOBAL);
    const useDiseaseFallback = parseBooleanEnv(
      process.env.REACT_APP_USE_DISEASE_FALLBACK,
      DEFAULT_USE_DISEASE_FALLBACK
    );
    if (useWhoGlobal) {
      const publicBase = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
      const publicCsvUrl = `${publicBase}/csv/WHO-COVID-19-global-data.csv`;
      const primaryWhoCsvUrl = process.env.REACT_APP_WHO_GLOBAL_CSV_URL
        || publicCsvUrl;
      const whoCsvCandidates = [
        primaryWhoCsvUrl,
        publicCsvUrl,
        '/csv/WHO-COVID-19-global-data.csv'
      ].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);
      for (let i = 0; i < whoCsvCandidates.length; i += 1) {
        const whoCsvUrl = whoCsvCandidates[i];
        try {
          const whoResponse = await axios.get(whoCsvUrl, {
            timeout: WHO_GLOBAL_TIMEOUT_MS,
            responseType: 'text',
            headers: {
              Accept: 'text/csv,application/csv,text/plain,*/*'
            }
          });
          const mapped = parseWhoGlobalCsv(typeof whoResponse.data === 'string' ? whoResponse.data : '');
          if (mapped) {
            return mapped;
          }
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`WHO CSV not parseable from ${whoCsvUrl}`);
          }
        } catch (whoError) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`WHO CSV fetch failed from ${whoCsvUrl}:`, whoError.message);
          }
        }
      }

      if (!useDiseaseFallback) {
        // Keep dashboard resilient even when strict mode is requested.
        console.warn('WHO CSV unavailable and strict mode enabled. Falling back to disease.sh to avoid blank dashboard.');
      } else {
        console.warn('WHO CSV unavailable, falling back to disease.sh');
      }
    }

    const response = await apiClient.get(ENDPOINTS.GLOBAL);
    return { ...response.data, source: 'disease.sh' };
  } catch (error) {
    console.error(`Error fetching global data: ${error.message}`);
    throw error;
  }
};

// Country data services
export const fetchAllCountries = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.COUNTRIES);
    const countries = Array.isArray(response.data) ? response.data : [];
    const krFromDataGoKr = await withTimeout(fetchKoreaFromDataGoKr(), 1500, null);
    if (!krFromDataGoKr) return countries;

    const krIndex = countries.findIndex((country) => country?.countryInfo?.iso2 === 'KR' || country?.country === 'S. Korea');
    if (krIndex >= 0) {
      countries[krIndex] = { ...countries[krIndex], ...krFromDataGoKr };
    } else {
      countries.push(krFromDataGoKr);
    }
    return countries;
  } catch (error) {
    console.error(`Error fetching countries data: ${error.message}`);
    throw error;
  }
};

export const fetchCountryData = async (country) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    const normalizedCountry = String(country).toLowerCase();
    if (normalizedCountry === 'kr' || normalizedCountry === 'korea' || normalizedCountry === 'south korea' || normalizedCountry === 's. korea') {
      const krFromDataGoKr = await withTimeout(fetchKoreaFromDataGoKr(), 2500, null);
      if (krFromDataGoKr) {
        return krFromDataGoKr;
      }
    }

    const response = await apiClient.get(ENDPOINTS.COUNTRY(country));
    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${country}: ${error.message}`);
    throw error;
  }
};

// Historical data services
export const fetchHistoricalAllData = async (days = 30) => {
  try {
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_ALL(days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical global data: ${error.message}`);
    throw error;
  }
};

export const fetchHistoricalCountryData = async (country, days = 30) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_COUNTRY(country, days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical data for ${country}: ${error.message}`);
    throw error;
  }
};

export const fetchHistoricalCountriesData = async (days = 2) => {
  try {
    const response = await apiClient.get(ENDPOINTS.HISTORICAL_COUNTRIES(days));
    return response.data;
  } catch (error) {
    console.error(`Error fetching historical countries data: ${error.message}`);
    throw error;
  }
};

// Vaccination data services
export const fetchVaccineData = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.VACCINE);
    return response.data;
  } catch (error) {
    console.error(`Error fetching vaccine data: ${error.message}`);
    throw error;
  }
};

export const fetchCountryVaccineData = async (country) => {
  if (!country) {
    throw new Error('Country parameter is required');
  }
  
  try {
    const response = await apiClient.get(ENDPOINTS.VACCINE_COUNTRY(country));
    return response.data;
  } catch (error) {
    console.error(`Error fetching vaccine data for ${country}: ${error.message}`);
    throw error;
  }
};

// Continent data service
export const fetchContinentsData = async () => {
  try {
    const response = await apiClient.get(ENDPOINTS.CONTINENTS);
    return response.data;
  } catch (error) {
    console.error(`Error fetching continents data: ${error.message}`);
    throw error;
  }
};

// Dashboard data with simplified error handling
export const fetchDashboardData = async (country = 'all') => {
  try {
    const currentData = country === 'all'
      ? await fetchGlobalData()
      : await fetchCountryData(country);

    const historicalData = country === 'all'
      ? await fetchHistoricalAllData(90)
      : await fetchHistoricalCountryData(country, 90);

    // Vaccine endpoint can fail depending on API limits/data availability.
    // Keep dashboard resilient by returning null instead of throwing.
    let vaccineData = null;
    try {
      vaccineData = country === 'all'
        ? await fetchVaccineData()
        : await fetchCountryVaccineData(country);
    } catch (vaccineError) {
      console.warn('Vaccine data unavailable, continuing without it:', vaccineError.message);
    }

    return {
      current: currentData,
      historical: historicalData,
      vaccine: vaccineData,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    throw new Error(`Error fetching dashboard data: ${error.message}`);
  }
};

// Get top affected countries
export const fetchTopCountries = async (limit = 10, sortBy = 'cases') => {
  try {
    const countries = await fetchAllCountries();
    return countries
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, limit);
  } catch (error) {
    console.error(`Error fetching top countries: ${error.message}`);
    throw error;
  }
};