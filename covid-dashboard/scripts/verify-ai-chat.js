/**
 * 로컬 검증: WHO 질의 판별·거부 응답 감지·데이터 파일·모듈 로드 (Azure API 호출 없음).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { shouldForceWhoRawLookup, isDataAccessDenial } = require('../api/who-query-predicates');

const u = (text) => [{ role: 'user', content: text }];

assert.strictEqual(shouldForceWhoRawLookup(u('who.txt 자료 분석해줘')), true, 'who.txt → WHO 경로');
assert.strictEqual(shouldForceWhoRawLookup(u('who_raw 열 뭐야')), true, 'who_raw');
assert.strictEqual(shouldForceWhoRawLookup(u('covid trend')), true, 'covid');
assert.strictEqual(shouldForceWhoRawLookup(u('세계보건기구 데이터')), true, '세계보건기구');
assert.strictEqual(shouldForceWhoRawLookup(u('오늘 서울 날씨')), false, '무관 질문');

assert.strictEqual(
  isDataAccessDenial('다만 현재 대화에는 who.txt의 실제 내용이 보이지 않습니다.'),
  true,
  '보이지 않음 템플릿'
);
assert.strictEqual(isDataAccessDenial('파일을 업로드해 주시거나'), true);
assert.strictEqual(isDataAccessDenial('WHO CSV 기준으로 확진 추세는 안정적입니다.'), false);

const whoRaw = path.resolve(__dirname, '../public/csv/who_raw');
assert.ok(fs.existsSync(whoRaw), `missing ${whoRaw}`);
const head = fs.readFileSync(whoRaw, 'utf8').split(/\r?\n/).slice(0, 2).join('\n');
assert.ok(head.includes('Date_reported'), 'who_raw header expected');

require('../api/azure-who-assistants');
require('../api/ai-agent-chat');

console.log('verify-ai-chat: all checks passed');
