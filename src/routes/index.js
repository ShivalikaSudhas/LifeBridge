const express = require('express');
const router = express.Router();

const emergencyRoutes = require('./emergency');
const dispatchRoutes  = require('./dispatch');
const aiRoutes        = require('./ai');

router.use('/emergency', emergencyRoutes);
router.use('/dispatch',  dispatchRoutes);
router.use('/ai',        aiRoutes);

module.exports = router;
