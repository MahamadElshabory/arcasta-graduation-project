//chat.js
const router = require('express').Router();
const axios = require('axios');

// Put this in .env in prod
// RASA_URL=http://127.0.0.1:5005/webhooks/rest/webhook
const RASA_URL = process.env.RASA_URL || 'http://127.0.0.1:5005/webhooks/rest/webhook';

router.post('/chat', async (req, res) => {
  try {
    console.log('AUTH header:', req.headers.authorization)
    const user = req.session?.user;
    const sender =
      user?.supplierID ||
      user?.id ||
      req.body.deviceId ||
      `anon-${(req.ip || '').replace(/[:.]/g, '-')}`;

    const { message, metadata } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // ---- inject auth token into metadata so Rasa actions can call your APIs ----
    const meta = { ...(metadata || {}) };
    if (user?.jwt) {
      meta.jwt = user.jwt;
    } else if (user?.token) {
      meta.jwt = user.token;
    } else if (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
      meta.jwt = req.headers.authorization.slice(7);
    }
    console.log('Forwarding metadata.jwt?', Boolean(meta.jwt));

    const { data } = await axios.post(
      RASA_URL,
      { sender, message, metadata: meta },
      { timeout: 15000 }
    );

    // Rasa returns an array of bot messages
    res.json({ sender, replies: data });
  } catch (err) {
    console.error('Chat proxy error:', err?.message);
    res.status(502).json({ error: 'Chatbot unavailable' });
  }
});

module.exports = router;
