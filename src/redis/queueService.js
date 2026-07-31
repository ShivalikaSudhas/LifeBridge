const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const QUEUE_KEY = 'emergency_priority_queue';

const PRIORITY_SCORES = {
  CRITICAL: 100,
  HIGH:     75,
  MEDIUM:   50,
  LOW:      25,
};

/**
 * Add a request to the Redis priority queue.
 */
const addToQueue = async (requestId, priority) => {
  const score = PRIORITY_SCORES[priority];
  if (score === undefined) {
    throw new Error(`Unknown priority: ${priority}`);
  }
  await redisClient.zAdd(QUEUE_KEY, [{ score, value: String(requestId) }]);
  logger.info(`Queue: added request ${requestId} with priority ${priority} (score ${score})`);
};

/**
 * Remove a request from the queue (after dispatch).
 */
const removeFromQueue = async (requestId) => {
  const removed = await redisClient.zRem(QUEUE_KEY, String(requestId));
  logger.info(`Queue: removed request ${requestId} (removed count: ${removed})`);
  return removed;
};

/**
 * Get all pending requests ordered by priority (highest first).
 * Returns array of { value: requestId, score }
 */
const getPendingQueue = async () => {
  const results = await redisClient.zRangeWithScores(QUEUE_KEY, 0, -1, { REV: true });
  return results; // [{ value: '5', score: 100 }, ...]
};

/**
 * Get the highest-priority request ID (CRITICAL first).
 */
const getHighestPriority = async () => {
  const results = await redisClient.zRange(QUEUE_KEY, 0, 0, { REV: true });
  return results.length ? parseInt(results[0]) : null;
};

/**
 * Get total number of requests in queue.
 */
const getQueueLength = async () => {
  return redisClient.zCard(QUEUE_KEY);
};

module.exports = {
  addToQueue,
  removeFromQueue,
  getPendingQueue,
  getHighestPriority,
  getQueueLength,
  PRIORITY_SCORES,
};
