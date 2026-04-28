const axios = require('axios');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    for (let i = 0; i < candidateModels.length; i += 1) {
      const model = candidateModels[i];
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            params: { key: apiKey },
            timeout: 15000
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
    res.status(200).json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message || 'AI agent request failed.' });
  }
};
