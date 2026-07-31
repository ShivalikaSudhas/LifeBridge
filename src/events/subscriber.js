const { createClient } = require('redis');
const env = require('../config/env');
const logger = require('../utils/logger');
const { Notification } = require('../models');

const CHANNELS = [
  'emergency_created',
  'responder_assigned',
  'status_updated',
  'notification_sent',
];

/**
 * Handles incoming events:
 * - Logs the event
 * - Persists a Notification record to PostgreSQL
 */
const handleEvent = async (message, channel) => {
  try {
    const payload = JSON.parse(message);
    logger.info(`Event received ← [${channel}]: ${JSON.stringify(payload)}`);

    // Persist notification record for all events that have a request_id
    if (payload.request_id) {
      await Notification.create({
        request_id:  payload.request_id,
        responder_id: payload.responder_id || null,
        message:     `[${channel}] ${JSON.stringify(payload)}`,
        created_at:  new Date(),
      });
    }
  } catch (err) {
    logger.error(`Event handler error on [${channel}]: ${err.message}`);
  }
};

/**
 * Start the Redis Pub/Sub subscriber in a separate client connection.
 * Must be called once in server.js after DB is ready.
 */
const startSubscriber = async () => {
  const subscriber = createClient({ url: env.REDIS_URL });
  subscriber.on('error', (err) => logger.error(`Subscriber Redis error: ${err.message}`));
  await subscriber.connect();

  await subscriber.subscribe(CHANNELS, handleEvent);
  logger.info(`Event subscriber listening on channels: ${CHANNELS.join(', ')}`);
};

module.exports = { startSubscriber };
