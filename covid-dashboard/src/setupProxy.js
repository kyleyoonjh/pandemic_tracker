const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const express = require('express');
const https = require('https');
const axios = require('axios');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = function setupProxy(app) {
  app.use('/api/ai-agent-chat', express.json({ limit: '1mb' }));

  app.post('/api/ai-agent-chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'GEMINI_API_KEY is missing in environment.' });
        return;
      }
      const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const openAiApiKey = process.env.OPENAI_API_KEY;
      const openAiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const safeMessages = incomingMessages
        .filter((msg) => msg && typeof msg.content === 'string')
        .map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          content: msg.content
        }))
        .slice(-16);

      const normalized = String(preferredModel).replace(/^models\//, '');
      const candidateModels = [normalized, 'gemini-flash-latest']
        .filter((value, index, self) => value && self.indexOf(value) === index);
      const maxModelAttempts = Math.max(1, Number(process.env.GEMINI_MAX_MODEL_ATTEMPTS || 2));
      const modelCandidates = candidateModels.slice(0, maxModelAttempts);
      const requestTimeoutMs = Math.max(2000, Number(process.env.GEMINI_TIMEOUT_MS || 10000));
      const enableWebSearch = String(process.env.GEMINI_ENABLE_WEB_SEARCH || 'true').toLowerCase() !== 'false';
      const payload = {
        systemInstruction: {
          parts: [{
            text: `당신은 2024-2026년 팬데믹 데이터 분석 전문가입니다.
항상 CSV 데이터 구조를 기반으로 답변하며,
전문 용어를 사용하되 친절하게 설명하세요.`
          }]
        },
        generationConfig: {
          temperature: 0.3
        },
        ...(enableWebSearch ? { tools: [{ google_search: {} }] } : {}),
        contents: safeMessages.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }))
      };

      let data = null;
      let lastError = null;
      const insecureSsl = String(process.env.ALLOW_INSECURE_SSL || 'true').toLowerCase() === 'true';
      const httpsAgent = insecureSsl ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      for (let i = 0; i < modelCandidates.length; i += 1) {
        const model = modelCandidates[i];
        try {
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            payload,
            {
              headers: { 'Content-Type': 'application/json' },
              params: { key: apiKey },
              timeout: requestTimeoutMs,
              httpsAgent
            }
          );
          data = response.data;
          break;
        } catch (error) {
          lastError = error;
          const status = Number(error?.response?.status || 0);
          const code = String(error?.code || '').toUpperCase();
          const retryableNetwork = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET';
          if (status === 404 || status === 429 || status === 503 || retryableNetwork) {
            await sleep(120);
            continue;
          }
          break;
        }
      }

      if (!data && openAiApiKey) {
        const status = Number(lastError?.response?.status || 0);
        if (status === 429 || status === 503) {
          try {
            const geminiErrorDetail = lastError?.response?.data || lastError?.message || 'Gemini request failed';
            const openAiMessages = incomingMessages
              .filter((msg) => msg && typeof msg.content === 'string')
              .map((msg) => ({
                role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
                content: msg.content
              }))
              .slice(-16);
            const openAiResponse = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: openAiModel,
                temperature: 0.3,
                messages: openAiMessages
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${openAiApiKey}`
                },
                timeout: requestTimeoutMs,
                httpsAgent
              }
            );
            const fallbackAnswer = String(openAiResponse?.data?.choices?.[0]?.message?.content || '').trim();
            if (fallbackAnswer) {
              res.json({
                answer: fallbackAnswer,
                provider: 'openai-fallback',
                fallbackError: typeof geminiErrorDetail === 'string' ? geminiErrorDetail : JSON.stringify(geminiErrorDetail)
              });
              return;
            }
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }
      }

      if (!data) {
        const statusCode = Number(lastError?.response?.status || 500);
        const detail = lastError?.response?.data || lastError?.message || 'Unknown Gemini/OpenAI error';
        res.status(statusCode).json({ error: `AI provider error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` });
        return;
      }

      const answer = (data?.candidates?.[0]?.content?.parts || [])
        .map((part) => String(part?.text || ''))
        .join('\n')
        .trim();
      res.json({ answer, provider: 'gemini' });
    } catch (error) {
      res.status(500).json({ error: error.message || 'AI agent request failed.' });
    }
  });

  app.get('/api/who-global-data-local.csv', (req, res) => {
    const localCsvPath = path.resolve(__dirname, '../csv/WHO-COVID-19-global-data.csv');
    res.sendFile(localCsvPath);
  });

  app.use(
    '/api/kr-covid',
    createProxyMiddleware({
      target: 'https://apis.data.go.kr',
      changeOrigin: true,
      pathRewrite: {
        '^/api/kr-covid': '/1352000/ODMS_COVID_04/callCovid04Api'
      }
    })
  );

  app.use(
    '/api/who-global-data.csv',
    createProxyMiddleware({
      target: 'https://srhdpeuwpubsa.blob.core.windows.net',
      changeOrigin: true,
      pathRewrite: {
        '^/api/who-global-data.csv': '/whdh/COVID/WHO-COVID-19-global-data.csv'
      },
      headers: {
        Accept: 'text/csv,application/csv,text/plain,*/*'
      }
    })
  );
};
