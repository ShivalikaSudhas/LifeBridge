const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { validate, classifySchema } = require('../middleware/validate');

/**
 * POST /api/v1/ai/classify
 * Endpoint to classify emergency priority from incident description.
 */
router.post('/classify', validate(classifySchema), aiController.classifyPriority);

module.exports = router;
