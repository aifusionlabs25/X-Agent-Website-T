# Hermes Tavus Hosted Memory Start T20 Proof

Phase T20 performed one approved hosted memory-start POST to the deployed site using the Phase T19 hosted harness.

## Precondition

Production Vercel environment values were confirmed before the POST:

- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true`
- `XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true`
- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false`

## Result

- Exactly one hosted POST was attempted.
- Hosted endpoint: `https://x-agent-website-t.vercel.app/api/conversation/start`
- HTTP status: `200`
- `conversation_url_present=true`
- `provider_conversation_id=c4a71fe80750a436`
- `memory_context_requested=false`
- `memory_context_applied=false`
- `tavus_conversational_context_attached=false`

The hosted POST created a Tavus conversation but did not confirm memory attachment. The response did not include the T16 app-owned identity fields either, which suggests the live deployment serving the hosted domain may not be running the T16+ route code, or the request is hitting a deployment/version that ignores the supplied `memory_context` body.

## Boundaries

- The normal customer-facing button was not changed.
- The Tavus room was not joined.
- The actual room URL was not stored.
- Tavus `memory_stores` was not used.
- Memory was not placed in `custom_greeting`.
- No webhook was added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory call was made.
- No prompt text, memory summary, hashes, namespaces, backend IDs, transcript, content, messages, actual room URL, or API key were stored.

## Evidence

- Safe proof artifact: `docs/proofs/hermes_tavus_hosted_memory_start_t20_safe_capture.json`
- Hosted harness: `scripts/manual-hosted-tavus-memory-start.mjs`
- Normal button audit: `docs/HERMES_TAVUS_HOSTED_MEMORY_START_AUDIT.md`

## Next Decision

The next decision is to resolve the hosted deployment/version mismatch before another hosted memory-start attempt. Do not join the created Tavus room for remembered-context evaluation because this T20 run did not attach memory.
