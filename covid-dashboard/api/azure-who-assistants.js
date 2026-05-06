const fs = require('fs');
const path = require('path');
const { AzureOpenAI, toFile } = require('openai');

/** 로컬 WHO 데이터 파일 (Gemini 업로드와 동일하게 public/csv/who_raw 우선). */
const WHO_DATA_CANDIDATES = [
  path.resolve(__dirname, '../public/csv/who_raw'),
  path.resolve(__dirname, '../csv/WHO-COVID-19-global-data.csv')
];

let knowledgeCache = {
  mtimeMs: 0,
  assistantId: '',
  vectorStoreId: ''
};

function resolveWhoDataPath() {
  for (const candidate of WHO_DATA_CANDIDATES) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      /* skip */
    }
  }
  return WHO_DATA_CANDIDATES[0];
}

function extractAssistantMessageText(message) {
  const parts = Array.isArray(message?.content) ? message.content : [];
  const chunks = [];
  for (const part of parts) {
    if (part?.type === 'text' && part.text?.value) {
      chunks.push(part.text.value);
    }
  }
  return chunks.join('\n').trim();
}

/**
 * who_raw / WHO CSV를 벡터 스토어에 올리고 file_search용 Assistant를 준비합니다.
 * 파일 mtime이 바뀌면 새 벡터 스토어를 만들고 기존 Assistant의 tool_resources만 갱신합니다.
 */
async function ensureAzureWhoKnowledgeBase(client, deploymentName, pollOptions) {
  const whoPath = resolveWhoDataPath();
  const stat = fs.statSync(whoPath);
  const mtimeMs = Number(stat.mtimeMs || 0);

  if (
    knowledgeCache.assistantId
    && knowledgeCache.vectorStoreId
    && knowledgeCache.mtimeMs === mtimeMs
  ) {
    return knowledgeCache;
  }

  const uploadName = 'WHO-COVID-19-global-data.csv';
  const fileForUpload = await toFile(fs.createReadStream(whoPath), uploadName, { type: 'text/csv' });

  const vectorStore = await client.vectorStores.create({
    name: `who-covid-${mtimeMs}`
  });

  await client.vectorStores.fileBatches.uploadAndPoll(
    vectorStore.id,
    { files: [fileForUpload] },
    pollOptions
  );

  const previousVectorStoreId = knowledgeCache.vectorStoreId;

  if (knowledgeCache.assistantId) {
    await client.beta.assistants.update(knowledgeCache.assistantId, {
      model: deploymentName,
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: { vector_store_ids: [vectorStore.id] }
      }
    });
    knowledgeCache = {
      mtimeMs,
      assistantId: knowledgeCache.assistantId,
      vectorStoreId: vectorStore.id
    };
  } else {
    const assistant = await client.beta.assistants.create({
      name: 'COVID WHO 문서 분석',
      instructions:
        '벡터 스토어의 WHO COVID-19 CSV(WHO-COVID-19-global-data.csv, who.txt와 동일 데이터)만 file_search로 검색해 답하세요. 파일이 없다거나 업로드를 요구하지 마세요.',
      model: deploymentName,
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: { vector_store_ids: [vectorStore.id] }
      }
    });
    knowledgeCache = {
      mtimeMs,
      assistantId: assistant.id,
      vectorStoreId: vectorStore.id
    };
  }

  if (previousVectorStoreId && previousVectorStoreId !== vectorStore.id) {
    client.vectorStores.delete(previousVectorStoreId).catch(() => {});
  }

  return knowledgeCache;
}

/**
 * Azure OpenAI Assistants + file_search로 스레드를 실행하고 마지막 assistant 메시지 텍스트를 반환합니다.
 */
async function runAzureWhoAssistantsChat({
  endpoint,
  apiKey,
  apiVersion,
  deploymentName,
  fullInstructions,
  safeMessages,
  timeoutMs
}) {
  const client = new AzureOpenAI({
    endpoint: String(endpoint || '').trim().replace(/\/$/, ''),
    apiKey,
    apiVersion,
    deployment: deploymentName,
    timeout: Math.max(5000, Number(timeoutMs || 60000))
  });

  const pollOpts = { pollIntervalMs: 1500 };
  const { assistantId } = await ensureAzureWhoKnowledgeBase(client, deploymentName, pollOpts);

  await client.beta.assistants.update(assistantId, {
    instructions: fullInstructions
  });

  const thread = await client.beta.threads.create();

  const dialog = safeMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
  if (!dialog.length) {
    throw new Error('No user/assistant messages to send to Azure Assistants.');
  }

  for (const msg of dialog) {
    await client.beta.threads.messages.create(thread.id, {
      role: msg.role,
      content: msg.content
    });
  }

  const run = await client.beta.threads.runs.createAndPoll(
    thread.id,
    { assistant_id: assistantId },
    pollOpts
  );

  if (run.status !== 'completed') {
    const detail = run.last_error?.message || run.status;
    throw new Error(`Azure Assistants run did not complete: ${detail}`);
  }

  const listed = await client.beta.threads.messages.list(thread.id, { order: 'desc', limit: 20 });
  const assistantMsg = listed.data.find((m) => m.role === 'assistant');
  const text = extractAssistantMessageText(assistantMsg);
  if (!text) {
    throw new Error('Azure Assistants returned no assistant text.');
  }
  return text;
}

module.exports = { runAzureWhoAssistantsChat };
