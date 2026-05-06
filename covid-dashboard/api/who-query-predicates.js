/**
 * WHO/코로나 질의 감지 및 “데이터 없음” 템플릿 응답 감지 — ai-agent-chat / setupProxy 공통.
 */
const COVID_KEYWORDS = ['covid', '코로나', '팬데믹', '확진', '사망', '누적 확진', '누적 사망', 'sars-cov-2'];
const WHO_DATA_KEYWORDS = [
  'who.txt',
  'who_raw',
  'who-covid',
  'who covid',
  'who global',
  'who 데이터',
  'who자료',
  'world health organization',
  '세계보건기구'
];
const NON_COVID_TOPICS = ['백일해', 'pertussis'];

const shouldForceWhoRawLookup = (safeMessages) => {
  const latestUserMessage = [...safeMessages].reverse().find((m) => m.role === 'user');
  const query = String(latestUserMessage?.content || '').toLowerCase();
  const switchingAwayFromCovid = /코로나\s*말고|covid\s*말고|not\s+covid|instead of covid/i.test(query)
    || NON_COVID_TOPICS.some((topic) => query.includes(topic));
  if (switchingAwayFromCovid) return false;
  return COVID_KEYWORDS.some((keyword) => query.includes(keyword))
    || WHO_DATA_KEYWORDS.some((keyword) => query.includes(keyword));
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
    lowered.includes('데이터셋에 접근할 수 없') ||
    lowered.includes('내용이 보이지 않') ||
    lowered.includes('파일을 업로드') ||
    lowered.includes('업로드해 주') ||
    lowered.includes('내용을 그대로 붙여') ||
    lowered.includes('파일을 보내주')
  );
};

module.exports = {
  shouldForceWhoRawLookup,
  isDataAccessDenial,
  COVID_KEYWORDS,
  WHO_DATA_KEYWORDS
};
