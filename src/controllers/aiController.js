const emergencyService = require('../services/emergencyService');
const { success } = require('../utils/response');

/**
 * POST /api/v1/ai/classify
 * Endpoint to classify emergency priority from incident description.
 * Uses external Python AI microservice when available, with rule-based fallback.
 */
const classifyPriority = async (req, res, next) => {
  try {
    const { description } = req.body;
    const data = await emergencyService.classifyPriority(description);
    return success(res, data, 'Priority classified successfully', 200);
  } catch (err) {
    next(err);
  }
};

module.exports = { classifyPriority };
