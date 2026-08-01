const { success, error } = require('../utils/response');
const aiV2Service = require('../services/aiV2Service');

/**
 * POST /api/v1/ai/v2/triage
 * Advanced AI triage classification with score & safety guidelines.
 */
const triageIncident = async (req, res, next) => {
  const { description, location } = req.body;
  if (!description) {
    return error(res, 'description field is required', 400);
  }
  try {
    const result = await aiV2Service.triageEmergencyV2(description, location);
    return success(res, result, 'V2 Emergency Triage Completed', 200);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/ai/v2/recommend-responder
 * Recommends optimal responder based on AI triage matching.
 */
const recommendResponder = async (req, res, next) => {
  const { description, available_responders } = req.body;
  if (!description) {
    return error(res, 'description field is required', 400);
  }
  try {
    const result = await aiV2Service.recommendBestResponderV2(description, available_responders || []);
    return success(res, result, 'Responder recommendation generated', 200);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  triageIncident,
  recommendResponder,
};
