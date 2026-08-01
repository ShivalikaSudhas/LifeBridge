const express = require('express');
const router = express.Router();
const aiV2Controller = require('../controllers/aiV2Controller');

/**
 * POST /api/v1/ai/v2/triage
 * Enhanced multi-attribute AI triage analysis.
 */
router.post('/triage', aiV2Controller.triageIncident);

/**
 * POST /api/v1/ai/v2/recommend-responder
 * Smart matching algorithm for available responders.
 */
router.post('/recommend-responder', aiV2Controller.recommendResponder);

module.exports = router;
