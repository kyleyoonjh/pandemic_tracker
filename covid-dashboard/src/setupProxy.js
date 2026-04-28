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
      const preferredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const safeMessages = incomingMessages
        .filter((msg) => msg && typeof msg.content === 'string')
        .map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          content: msg.content
        }))
        .slice(-16);

      const normalized = String(preferredModel).replace(/^models\//, '');
      const candidateModels = [normalized, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite']
        .filter((value, index, self) => value && self.indexOf(value) === index);
      const payload = {
        systemInstruction: {
          parts: [{ text: 'You are a concise, practical assistant for pandemic dashboard users.' }]
        },
        generationConfig: {
          temperature: 0.3
        },
        contents: safeMessages.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }))
      };

      let data = null;
      let lastError = null;
      const insecureSsl = String(process.env.ALLOW_INSECURE_SSL || 'true').toLowerCase() === 'true';
      const httpsAgent = insecureSsl ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      for (let i = 0; i < candidateModels.length; i += 1) {
        const model = candidateModels[i];
        try {
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            payload,
            {
              headers: { 'Content-Type': 'application/json' },
              params: { key: apiKey },
              timeout: 15000,
              httpsAgent
            }
          );
          data = response.data;
          break;
        } catch (error) {
          lastError = error;
          const status = Number(error?.response?.status || 0);
          if (status === 404 || status === 429 || status === 503) {
            await sleep(250);
            continue;
          }
          break;
        }
      }

      if (!data) {
        const statusCode = Number(lastError?.response?.status || 500);
        const detail = lastError?.response?.data || lastError?.message || 'Unknown Gemini error';
        res.status(statusCode).json({ error: `Gemini error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` });
        return;
      }

      const answer = (data?.candidates?.[0]?.content?.parts || [])
        .map((part) => String(part?.text || ''))
        .join('\n')
        .trim();
      res.json({ answer });
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
