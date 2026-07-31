const emergencyRepository  = require('../repositories/emergencyRepository');
const responderRepository  = require('../repositories/responderRepository');
const { publish, CHANNELS } = require('../events/publisher');
const logger               = require('../utils/logger');

// Valid status transitions — key: current status, value: allowed next statuses
const ALLOWED_TRANSITIONS = {
  PENDING:     ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:    ['DISPATCHED', 'CANCELLED'],
  DISPATCHED:  ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['RESOLVED', 'CANCELLED'],
  RESOLVED:    [],
  CANCELLED:   [],
};

/**
 * Update emergency request status with transition validation.
 */
const updateStatus = async (requestId, newStatus) => {
  const request = await emergencyRepository.findById(requestId);
  if (!request) {
    const err = new Error(`Emergency request ${requestId} not found`);
    err.status = 404;
    throw err;
  }

  const allowed = ALLOWED_TRANSITIONS[request.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(
      `Invalid transition: ${request.status} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`
    );
    err.status = 400;
    throw err;
  }

  // Update status
  const updated = await emergencyRepository.updateStatus(requestId, newStatus);

  // If RESOLVED, release the responder
  if (newStatus === 'RESOLVED') {
    const { DispatchRecord } = require('../models');
    const record = await DispatchRecord.findOne({ where: { request_id: requestId } });
    if (record) {
      await responderRepository.updateAvailability(record.responder_id, 'AVAILABLE');
      logger.info(`Responder ${record.responder_id} released → AVAILABLE`);
    }
  }

  // Publish event
  await publish(CHANNELS.STATUS_UPDATED, {
    request_id: requestId,
    old_status: request.status,
    new_status: newStatus,
    timestamp:  new Date().toISOString(),
  });

  logger.info(`Status updated: request=${requestId}, ${request.status} → ${newStatus}`);

  return {
    request_id: updated.id,
    status:     updated.status,
    updated_at: updated.updated_at,
  };
};

module.exports = { updateStatus };
