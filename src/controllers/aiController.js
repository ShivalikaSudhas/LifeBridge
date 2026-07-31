const { success } = require('../utils/response');
const geminiService = require('../services/geminiService');
const keywordClassifier = require('../services/keywordClassifier');
const logger = require('../utils/logger');

/**
 * POST /api/v1/ai/classify
 * Try Gemini first; on any failure fall back to the rule-based classifier.
 */
const classifyPriority = async (req, res, next) => {
  const { description } = req.body;
  try {
    const aiResult = await geminiService.classifyPriorityWithGemini(description);
    return success(res, aiResult, 'Priority classified (AI)', 200);
  } catch (err) {
    logger.warn('Gemini classification failed, using keyword fallback: %s', err.message || err);
    try {
      const fallback = keywordClassifier.classify(description);
      return success(res, fallback, 'Priority classified (fallback)', 200);
    } catch (fallbackErr) {
      next(fallbackErr);
    }
  }
};

module.exports = { classifyPriority };
