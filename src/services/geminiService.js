const axios = require('axios');
const logger = require('../utils/logger');
const env = require('../config/env');
const { buildPrompt } = require('../prompts/priorityPrompt');
const keywordClassifier = require('./keywordClassifier');

/**
 * Attempts to classify incident priority using Google Gemini (GenAI).
 * This is a best-effort connector: it will try the official SDK if installed,
 * then fall back to a generic HTTP endpoint if `GEMINI_HTTP_URL` is provided.
 * If all attempts fail, the caller should catch and use a fallback classifier.
 */
async function classifyPriorityWithGemini(description) {
  if (!description || typeof description !== 'string') {
    throw new Error('description is required');
  }

  // Build the strict prompt we want Gemini to follow.
  const prompt = buildPrompt(description);

  // 1) Try official Node SDK (@google/genai) if installed (best-effort).
  try {
    // require inside try so missing package doesn't crash the app at startup
    // eslint-disable-next-line global-require
    const genai = require('@google/genai');
    if (genai) {
      // This is a best-effort invocation. Projects should adjust to the
      // exact SDK usage and model names per their installed version.
      const clientOpts = {};
      if (env.GEMINI_API_KEY) clientOpts.apiKey = env.GEMINI_API_KEY;
      const client = new genai.TextGenerationClient(clientOpts);

      const model = env.GEMINI_MODEL || 'text-bison@001';
      const resp = await client.generate({ model, input: prompt });
      // Attempt to extract text output from response in a few common shapes
      const text = resp?.outputText || (Array.isArray(resp?.outputs) ? resp.outputs.map(o => o.text || '').join('\n') : JSON.stringify(resp));
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch (e) {
        throw new Error('Gemini returned non-JSON output');
      }
    }
  } catch (err) {
    logger.warn('Gemini SDK not available or failed: %s', err.message || err);
  }

  // 2) If user provided a generic HTTP endpoint (optional), try it.
  if (env.GEMINI_HTTP_URL && env.GEMINI_API_KEY) {
    try {
      const r = await axios.post(env.GEMINI_HTTP_URL, { prompt }, {
        headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}` },
        timeout: 8000,
      });
      const text = r.data?.text || r.data?.output || JSON.stringify(r.data);
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Gemini HTTP endpoint returned non-JSON output');
      }
    } catch (err) {
      logger.warn('Gemini HTTP call failed: %s', err.message || err);
    }
  }

  // 3) No working Gemini connection — throw so caller can fallback to rules.
  throw new Error('No working Gemini connector available');
}

module.exports = { classifyPriorityWithGemini };
