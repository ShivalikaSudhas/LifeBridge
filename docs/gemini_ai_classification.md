# Gemini AI Classification

This document describes the Gemini AI classification service used to map free-text incident descriptions
to a structured JSON priority object for the LifeBridge dispatch system.

## Objective

Provide a single endpoint `POST /api/v1/ai/classify` that returns:

```
{
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": 0.0,
  "recommended_responder": "AMBULANCE|FIRE|POLICE|OTHER",
  "summary": "Short single-sentence summary"
}
```

## Implementation

- `src/prompts/priorityPrompt.js` — builds the strict prompt sent to Gemini (must return only JSON).
- `src/services/geminiService.js` — best-effort connector to Gemini (SDK or generic HTTP). Throws when unavailable.
- `src/services/keywordClassifier.js` — rule-based fallback classifier returning same JSON schema.
- `src/controllers/aiController.js` — endpoint controller; tries Gemini then falls back.
- `src/routes/ai.js` — route already wired: `POST /api/v1/ai/classify`.

## Environment

- `GEMINI_API_KEY` — required for Gemini access (SDK or HTTP). Set in `.env`.
- Optional: `GEMINI_MODEL`, `GEMINI_HTTP_URL` for custom HTTP integrations.

## Prompt

See `src/prompts/priorityPrompt.js` — the model is instructed to return only JSON with the schema described above.

## Fallback Strategy

If Gemini is unavailable (SDK missing, network or auth failure), the controller will call the rule-based
`keywordClassifier` to ensure the endpoint always returns a valid JSON response.

## Testing

Create at least 20 test cases covering:
- Cardiac arrest, building fire, drowning
- Vehicle crashes with bleeding, stabbing, shooting
- Fractures, fever, dizziness
- Minor cuts, noise complaints, assistance requests

Record model responses, latency, and accuracy in this document after evaluation.

## Next steps / improvements

- Add unit tests for `keywordClassifier`.
- Add integration tests that mock Gemini SDK responses.
- Add rate-limit and retry logic in `geminiService`.
- Harden JSON parsing when Gemini returns extraneous text.
