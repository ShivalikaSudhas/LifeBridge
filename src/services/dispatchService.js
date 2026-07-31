const emergencyRepository  = require('../repositories/emergencyRepository');
const responderRepository  = require('../repositories/responderRepository');
const dispatchRepository   = require('../repositories/dispatchRepository');
const queueService         = require('../redis/queueService');
const { publish, CHANNELS } = require('../events/publisher');
const logger               = require('../utils/logger');

/**
 * Assign a responder to an emergency request.
 * 1. Validate request exists and is PENDING
 * 2. Validate responder exists and is AVAILABLE
 * 3. Create dispatch record
 * 4. Update request status → ASSIGNED
 * 5. Update responder → BUSY
 * 6. Remove from Redis queue
 * 7. Publish event
 */
const assignResponder = async (requestId, responderId) => {
  // 1. Validate request
  const request = await emergencyRepository.findById(requestId);
  if (!request) {
    const err = new Error(`Emergency request ${requestId} not found`);
    err.status = 404;
    throw err;
  }
  if (request.status !== 'PENDING') {
    const err = new Error(`Request ${requestId} is not PENDING (current: ${request.status})`);
    err.status = 400;
    throw err;
  }

  // 2. Validate responder
  const responder = await responderRepository.findById(responderId);
  if (!responder) {
    const err = new Error(`Responder ${responderId} not found`);
    err.status = 404;
    throw err;
  }
  if (responder.availability !== 'AVAILABLE') {
    const err = new Error(`Responder ${responderId} is not AVAILABLE (current: ${responder.availability})`);
    err.status = 409;
    throw err;
  }

  // 3. Create dispatch record
  const dispatch = await dispatchRepository.create(requestId, responderId);

  // 4. Update request status
  await emergencyRepository.updateStatus(requestId, 'ASSIGNED');

  // 5. Update responder to BUSY
  await responderRepository.updateAvailability(responderId, 'BUSY');

  // 6. Remove from Redis queue
  await queueService.removeFromQueue(requestId);

  // 7. Publish event
  await publish(CHANNELS.RESPONDER_ASSIGNED, {
    request_id:  requestId,
    responder_id: responderId,
    timestamp:   new Date().toISOString(),
  });

  logger.info(`Dispatch: request=${requestId} assigned to responder=${responderId}`);

  return {
    request_id:   requestId,
    responder_id: responderId,
    status:       'ASSIGNED',
    assigned_at:  dispatch.assigned_at,
  };
};

module.exports = { assignResponder };
