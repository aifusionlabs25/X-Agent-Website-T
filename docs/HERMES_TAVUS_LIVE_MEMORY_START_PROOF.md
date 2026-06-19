# Hermes Tavus Live Memory Start Proof

Phase T17 made one controlled live `POST /api/conversation/start` request with Dani memory-context gates open and the validated local memory fixture supplied as `memory_context`.

## Result

- Exactly one local route POST was attempted.
- The local Next server logged `POST /api/conversation/start 200`.
- The route can only return `200` after `createConversation` returns successfully, so Tavus accepted the create-conversation request.
- The client-side safe-field extraction failed after the server logged `200`; no retry was performed.
- Conversation URL and provider conversation ID were not safely captured.

## Boundaries

- No Tavus room was joined.
- No Tavus `memory_stores` field was used.
- Memory was not placed in `custom_greeting`.
- No webhook route was added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory persistence call was made.
- No memory summary, prompt text, `conversational_context`, hashes, namespaces, raw transcript content, or API key was stored in the proof artifact.

## Evidence

- Summary-only artifact: `docs/proofs/hermes_tavus_live_memory_start_20260619T075555.json`
- Pre-live tests passed:
  - `npm run test:hermes-tavus-memory-injection`
  - `npm run test:hermes-session-memory-context`
  - `npm run test:hermes-tavus-memory-prompt-preview`
  - `npm run test:hermes-tavus-conversation-memory-payload-preview`

## Next Decision

A separate approval is required before any Tavus room join or live behavior evaluation. Because the response body was not safely captured, this proof does not provide a conversation URL or provider conversation ID for manual join.
