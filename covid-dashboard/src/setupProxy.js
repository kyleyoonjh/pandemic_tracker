const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const express = require('express');

module.exports = function setupProxy(app) {
  app.use('/api/ai-agent-chat', express.json({ limit: '1mb' }));

  app.post('/api/ai-agent-chat', async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY is missing in environment.' });
        return;
      }
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const safeMessages = incomingMessages
        .filter((msg) => msg && typeof msg.content === 'string')
        .map((msg) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
        .slice(-16);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: 'You are a concise, practical assistant for pandemic dashboard users.'
            },
            ...safeMessages
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({ error: `OpenAI error: ${errorText}` });
        return;
      }
      const data = await response.json();
      const answer = data?.choices?.[0]?.message?.content || '';
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
