const express = require('express');
const router = express.Router();

const emergencyRoutes = require('./emergency');
const dispatchRoutes  = require('./dispatch');
const aiRoutes        = require('./ai');
const aiV2Routes      = require('./aiV2');

router.use('/emergency', emergencyRoutes);
router.use('/dispatch',  dispatchRoutes);
router.use('/ai',        aiRoutes);
router.use('/ai/v2',     aiV2Routes);

module.exports = router;
