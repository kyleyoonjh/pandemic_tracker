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
    res.status(200).json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message || 'AI agent request failed.' });
  }
};
