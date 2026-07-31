const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatchController');
const { validate, assignResponderSchema } = require('../middleware/validate');

/**
 * POST /api/v1/dispatch/assign
 * Assign an available responder to an emergency request.
 */
router.post('/assign', validate(assignResponderSchema), dispatchController.assignResponder);

/**
 * POST /api/v1/dispatch/notify/:request_id
 * Trigger real-time event notification for responder dispatch.
 */
router.post('/notify/:request_id', dispatchController.sendNotification);

module.exports = router;
