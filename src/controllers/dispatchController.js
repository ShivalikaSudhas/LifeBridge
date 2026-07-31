const dispatchService = require('../services/dispatchService');
const notificationService = require('../services/notificationService');
const { success } = require('../utils/response');

/**
 * POST /api/v1/dispatch/assign
 * Assign an available responder to a pending emergency request.
 */
const assignResponder = async (req, res, next) => {
  try {
    const { request_id, responder_id } = req.body;
    const data = await dispatchService.assignResponder(request_id, responder_id);
    return success(res, data, 'Responder assigned successfully', 200);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/dispatch/notify/:request_id
 * Trigger a real-time dispatch notification for an assigned emergency request.
 */
const sendNotification = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.request_id);
    const data = await notificationService.sendNotification(requestId);
    return success(res, data, 'Dispatch notification sent successfully', 200);
  } catch (err) {
    next(err);
  }
};

module.exports = { assignResponder, sendNotification };
