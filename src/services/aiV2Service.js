const axios = require('axios');
const logger = require('../utils/logger');
const env = require('../config/env');
const keywordClassifier = require('./keywordClassifier');

/**
 * AI V2 Service: Advanced Triage & Smart Dispatch Recommendation.
 * Provides multi-attribute triage analysis, score calculation,
 * and candidate responder ranking with fallback capabilities.
 */
async function triageEmergencyV2(description, location = '') {
  if (!description || typeof description !== 'string') {
    throw new Error('Description is required for V2 triage');
  }

  // Attempt official SDK / HTTP endpoint if configured
  if (env.GEMINI_HTTP_URL && env.GEMINI_API_KEY) {
    try {
      const prompt = `Analyze this emergency incident: "${description}" located at "${location}".
Return ONLY a valid JSON object with the following fields:
{
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "score": number (1-100),
  "recommended_responder": "AMBULANCE" | "FIRE" | "POLICE",
  "summary": "Brief 1-sentence triage summary",
  "safety_instructions": ["Step 1", "Step 2"]
}`;

      const response = await axios.post(env.GEMINI_HTTP_URL, { prompt }, {
        headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}` },
        timeout: 8000,
      });

      const text = response.data?.text || response.data?.output || JSON.stringify(response.data);
      const parsed = JSON.parse(text);
      return {
        ...parsed,
        method: 'ai_gemini_v2',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn('AI V2 Service call failed, using rule-based fallback: %s', err.message || err);
    }
  }

  // Fallback to rule-engine logic with V2 schema enrichment
  const baseResult = keywordClassifier.classify(description);
  const scoreMap = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 25 };

  return {
    priority: baseResult.priority,
    score: scoreMap[baseResult.priority] || 50,
    recommended_responder: baseResult.recommended_responder,
    summary: baseResult.summary || 'Emergency incident recorded and classified.',
    safety_instructions: [
      'Ensure caller is in a safe location',
      'Do not move injured individuals unless immediate danger exists',
      'Keep phone line open for dispatch updates'
    ],
    confidence: baseResult.confidence,
    method: 'rule_based_v2_fallback',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Ranks candidate responders for an emergency request based on responder type and availability.
 */
async function recommendBestResponderV2(requestDescription, availableResponders = []) {
  const triage = await triageEmergencyV2(requestDescription);
  const targetType = triage.recommended_responder;

  const rankedResponders = availableResponders.map(responder => {
    let matchScore = 50;
    if (responder.responder_type === targetType) matchScore += 40;
    if (responder.availability === 'AVAILABLE') matchScore += 10;
    return {
      ...responder,
      matchScore,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  return {
    triage,
    recommended_type: targetType,
    best_match: rankedResponders[0] || null,
    candidate_rankings: rankedResponders,
  };
}

module.exports = {
  triageEmergencyV2,
  recommendBestResponderV2,
};
