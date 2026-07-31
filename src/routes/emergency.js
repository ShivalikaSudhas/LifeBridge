const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { validate, createEmergencySchema, updateStatusSchema } = require('../middleware/validate');

/**
 * POST /api/v1/emergency
 * Create a new emergency request.
 */
router.post('/', validate(createEmergencySchema), emergencyController.createEmergency);

/**
 * GET /api/v1/emergency/pending
 * Get pending emergency requests from Redis priority queue.
 */
router.get('/pending', emergencyController.getPendingRequests);

/**
 * GET /api/v1/emergency/active
 * Get active emergency requests (ASSIGNED, DISPATCHED, IN_PROGRESS).
 */
router.get('/active', emergencyController.getActiveRequests);

/**
 * PUT /api/v1/emergency/status
 * Update request status with state transition rules.
 */
router.put('/status', validate(updateStatusSchema), emergencyController.updateStatus);

module.exports = router;
