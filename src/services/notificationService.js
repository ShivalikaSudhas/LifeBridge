const dispatchRepository     = require('../repositories/dispatchRepository');
const notificationRepository  = require('../repositories/notificationRepository');
const emergencyRepository     = require('../repositories/emergencyRepository');
const { publish, CHANNELS }  = require('../events/publisher');
const logger                  = require('../utils/logger');

/**
 * Send a dispatch notification for an assigned emergency request.
 * 1. Find the request
 * 2. Find the dispatch record (must exist)
 * 3. Create notification record
 * 4. Publish notification event
 */
const sendNotification = async (requestId) => {
  // 1. Find request
  const request = await emergencyRepository.findById(requestId);
  if (!request) {
    const err = new Error(`Emergency request ${requestId} not found`);
    err.status = 404;
    throw err;
  }

  // 2. Find dispatch record
  const dispatch = await dispatchRepository.findByRequestId(requestId);
  if (!dispatch) {
    const err = new Error(`No dispatch record found for request ${requestId}. Assign a responder first.`);
    err.status = 404;
    throw err;
  }

  const responderId = dispatch.responder_id;
  const message = `Dispatch alert: Responder ${dispatch.responder.name} assigned to request #${requestId} — ${request.priority} priority at ${request.location}`;

  // 3. Create notification record
  const notification = await notificationRepository.create({
    request_id:   requestId,
    responder_id: responderId,
    message,
  });

  // 4. Publish event
  await publish(CHANNELS.NOTIFICATION_SENT, {
    request_id:      requestId,
    responder_id:    responderId,
    notification_id: notification.id,
    timestamp:       new Date().toISOString(),
  });

  logger.info(`Notification sent: request=${requestId}, responder=${responderId}`);

  return {
    notification_id: notification.id,
    request_id:      requestId,
    responder_id:    responderId,
    message,
    created_at:      notification.created_at,
  };
};

module.exports = { sendNotification };
