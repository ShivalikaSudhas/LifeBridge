const basePrompt = `You are an Emergency AI Dispatcher.

Analyze the emergency description and return ONLY a JSON object with the following schema:

{
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": 0.0,            // 0.0 - 1.0
  "recommended_responder": "AMBULANCE|FIRE|POLICE|OTHER",
  "summary": "Short (single-sentence) summary of the incident"
}

Choose ONLY one priority. Do NOT return any explanatory text or paragraphs. Always return valid JSON.

Priority guidance:
- CRITICAL: Life-threatening (cardiac arrest, building fire, drowning, unconscious, severe respiratory failure)
- HIGH: Serious (vehicle crash with injuries, heavy bleeding, stabbing, robbery in progress)
- MEDIUM: Moderate (fracture, non-severe injury, high fever, dizziness)
- LOW: Minor (minor cut, assistance request, noise complaint)

Examples (do not include these in output):
Cardiac arrest -> CRITICAL
Building fire -> CRITICAL
Bleeding from vehicle crash -> HIGH
Broken leg, conscious -> MEDIUM
Small cut on finger -> LOW
`;

function buildPrompt(description) {
  return basePrompt + '\n\nIncident description:\n' + description + '\n\nReturn only the JSON object.';
}

module.exports = { buildPrompt };
