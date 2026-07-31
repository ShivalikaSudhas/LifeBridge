/**
 * Simple keyword-based fallback classifier. Returns the same JSON shape
 * as the AI classifier so callers can depend on a consistent contract.
 */
function pickResponder(priority, descriptionLower) {
  if (priority === 'CRITICAL') {
    if (/fire|smoke/.test(descriptionLower)) return 'FIRE';
    return 'AMBULANCE';
  }
  if (priority === 'HIGH') {
    if (/robbery|assault|theft/.test(descriptionLower)) return 'POLICE';
    return 'AMBULANCE';
  }
  if (priority === 'MEDIUM') return 'AMBULANCE';
  return 'OTHER';
}

function summarize(description) {
  if (!description) return '';
  const s = description.trim();
  const first = s.split(/\.|\n/)[0];
  return first.length > 200 ? `${first.slice(0, 197)}...` : first;
}

function classify(description) {
  const d = (description || '').toLowerCase();
  let priority = 'LOW';
  let confidence = 0.6;

  if (/not breathing|cardiac arrest|unconscious|explosion|building fire|house fire|collapse|drowning|critical|severe difficulty breathing/.test(d)) {
    priority = 'CRITICAL';
    confidence = 0.95;
  } else if (/accident|bleeding|assault|chest pain|stabbing|vehicle crash|severe injury|gunshot|shooting/.test(d)) {
    priority = 'HIGH';
    confidence = 0.9;
  } else if (/fever|dizziness|fracture|broken|sprain|broken leg|broken arm/.test(d)) {
    priority = 'MEDIUM';
    confidence = 0.85;
  }

  const recommended_responder = pickResponder(priority, d);
  const summary = summarize(description);

  return {
    priority,
    confidence,
    recommended_responder,
    summary,
    method: 'rule_based',
  };
}

module.exports = { classify };
