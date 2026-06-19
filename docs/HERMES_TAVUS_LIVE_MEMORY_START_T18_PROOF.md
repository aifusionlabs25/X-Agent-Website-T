# Hermes Tavus Live Memory Start T18 Proof

Phase T18 performed one approved live Dani Tavus create-conversation rerun through `/api/conversation/start` with memory gates open and the Phase T17.1 Node capture harness.

## Result

- Exactly one live Tavus create-conversation attempt was made.
- The local route logged one `POST /api/conversation/start 200`.
- The Node harness safely captured the response fields.
- `conversation_url_present=true`.
- `provider_conversation_id=cc3bf45a98104499`.
- `memory_context_requested=true`.
- `memory_context_applied=true`.
- `tavus_conversational_context_attached=true`.

## Boundaries

- The Tavus room was not joined.
- The actual conversation URL was not stored.
- Tavus `memory_stores` was not used.
- Memory was not placed in `custom_greeting`.
- No webhook was added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory persistence call was made.
- No memory summary, prompt text, `conversational_context`, hashes, namespaces, backend proof IDs, transcript content, messages, or API key were stored.

## Evidence

- Safe proof artifact: `docs/proofs/hermes_tavus_live_memory_start_t18_safe_capture.json`
- Capture harness: `scripts/manual-tavus-live-memory-start.mjs`
- Pre-live validation:
  - `npm run test:hermes-live-memory-start-proof`
  - `npm run test:hermes-tavus-memory-injection`
  - `npm run test:hermes-manual-live-memory-start-script`

## Next Decision

The next decision is whether to manually join the captured Tavus conversation and evaluate whether Dani behaves as if she has remembered prior context. That requires separate approval.
