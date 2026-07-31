const userRepository       = require('../repositories/userRepository');
const emergencyRepository  = require('../repositories/emergencyRepository');
const queueService         = require('../redis/queueService');
const { publish, CHANNELS } = require('../events/publisher');
const logger               = require('../utils/logger');
const axios                = require('axios');
const env                  = require('../config/env');

/**
 * Rule-based priority classifier (fallback when AI service is unavailable).
 */
const classifyByRules = (description) => {
  const d = description.toLowerCase();
  if (/not breathing|cardiac arrest|unconscious|explosion|building fire|house fire|collapse|drowning|critical/.test(d)) {
    return { priority: 'CRITICAL', confidence: 1.0, method: 'rule_based' };
  }
  if (/accident|bleeding|assault|chest pain|stabbing|vehicle crash|severe injury/.test(d)) {
    return { priority: 'HIGH', confidence: 1.0, method: 'rule_based' };
  }
  if (/fever|dizziness|injury|broken|pain|breathless/.test(d)) {
    return { priority: 'MEDIUM', confidence: 1.0, method: 'rule_based' };
  }
  return { priority: 'LOW', confidence: 1.0, method: 'rule_based' };
};

/**
 * Try AI service first; fall back to rule-based on failure.
 */
const classifyPriority = async (description) => {
  try {
    const response = await axios.post(
      `${env.AI_SERVICE_URL}/classify`,
      { description },
      { timeout: 3000 }
    );
    return { ...response.data, method: 'ai_model' };
  } catch {
    logger.warn('AI service unavailable — using rule-based classifier');
    return classifyByRules(description);
  }
};

/**
 * Create a new emergency request.
 * 1. Validate user exists
 * 2. Classify priority
 * 3. Save to PostgreSQL
 * 4. Push to Redis queue
 * 5. Publish event
 */
const createEmergency = async ({ user_id, location, description }) => {
  // 1. Validate user
  const user = await userRepository.findById(user_id);
  if (!user) {
    const err = new Error(`User with id ${user_id} not found`);
    err.status = 404;
    throw err;
  }

  // 2. Classify priority
  const { priority } = await classifyPriority(description);

  // 3. Save to DB
  const request = await emergencyRepository.create({
    user_id,
    location,
    description,
    priority,
    status:     'PENDING',
    created_at: new Date(),
    updated_at: new Date(),
  });

  // 4. Push to Redis queue
  await queueService.addToQueue(request.id, priority);

  // 5. Publish event
  await publish(CHANNELS.EMERGENCY_CREATED, {
    request_id: request.id,
    priority,
    timestamp:  new Date().toISOString(),
  });

  logger.info(`Emergency created: id=${request.id}, priority=${priority}, user=${user_id}`);

  return {
    request_id: request.id,
    priority:   request.priority,
    status:     request.status,
    created_at: request.created_at,
  };
};

module.exports = { createEmergency, classifyPriority, classifyByRules };
