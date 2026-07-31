const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const CHANNELS = {
  EMERGENCY_CREATED:  'emergency_created',
  RESPONDER_ASSIGNED: 'responder_assigned',
  STATUS_UPDATED:     'status_updated',
  NOTIFICATION_SENT:  'notification_sent',
};

/**
 * Publish an event to a Redis Pub/Sub channel.
 * @param {string} channel - Channel name
 * @param {object} payload - Event payload (will be JSON serialized)
 */
const publish = async (channel, payload) => {
  try {
    await redisClient.publish(channel, JSON.stringify(payload));
    logger.info(`Event published → [${channel}]: ${JSON.stringify(payload)}`);
  } catch (err) {
    logger.error(`Failed to publish event on [${channel}]: ${err.message}`);
  }
};

module.exports = { publish, CHANNELS };
