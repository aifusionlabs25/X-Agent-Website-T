# Hermes Tavus Hosted Memory Start T21 Proof

Phase T21 verified the deployed Vercel production runtime before making one approved hosted memory-start POST.

## Readiness

- Expected deployed commit: `862c359`
- Vercel production build log confirmed GitHub `main` commit `862c359`.
- Runtime readiness endpoint: `https://x-agent-website-t.vercel.app/api/xagent/runtime-readiness`
- `xagent_session_identity_supported=true`
- `memory_context_injection_code_present=true`
- `tavus_conversational_context_supported=true`
- `memory_context_env_gates_open=true`

## Hosted POST Result

- Exactly one hosted memory-start POST was attempted.
- Hosted endpoint: `https://x-agent-website-t.vercel.app/api/conversation/start`
- HTTP status: `200`
- `conversation_url_present=true`
- `provider_conversation_id=c1fd221a0eaa74c0`
- `tenant_id=ai-fusion-labs`
- `agent_slug=dani`
- `provider=tavus`
- `memory_context_requested=true`
- `memory_context_applied=true`
- `tavus_conversational_context_attached=true`

This confirms the hosted route is now serving the T16+ memory code and attached Dani memory context through Tavus `conversational_context`.

## Boundaries

- The normal customer-facing button was not changed.
- The Tavus room was not joined.
- The actual room URL was not stored.
- Tavus `memory_stores` was not used.
- Memory was not placed in `custom_greeting`.
- No webhook was added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory call was made.
- No prompt text, memory summary, hashes, namespaces, backend proof IDs, transcript, content, messages, actual room URL, or API key were stored.

## Evidence

- Safe proof artifact: `docs/proofs/hermes_tavus_hosted_memory_start_t21_safe_capture.json`
- Hosted harness: `scripts/manual-hosted-tavus-memory-start.mjs`
- Runtime readiness helper: `lib/xagent/runtimeReadiness.mjs`

## Next Decision

The next decision is whether to manually join the captured Tavus conversation and evaluate whether Dani behaves as if she has remembered prior context.
