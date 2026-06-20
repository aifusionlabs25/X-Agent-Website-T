# Hermes Tavus Hosted Normal-Route Memory Start T25 Proof

Phase T25 verified the redeployed production site and ran exactly one hosted normal no-body `/api/conversation/start` POST.

This proof is intentionally redacted. It stores only safe route/result fields and does not store the actual room URL, prompt/context text, memory summary, hashes, namespaces, backend IDs, transcript content, messages, or Tavus API key.

## Pre-Live Result

- Production deployed commit: `f86b31f`
- Local `HEAD`: `f86b31f`
- Production T24 normal-site memory lookup code confirmed: `true`
- Runtime readiness endpoint was reachable and returned the base T16/T20 readiness fields.
- Production six memory gates were confirmed present, non-empty, and matching the required true/true/false plus true/true/false values.
- Local validation passed before the hosted POST.

## Hosted POST Result

- Hosted start URL: `https://x-agent-website-t.vercel.app/api/conversation/start`
- Hosted no-body POST attempted: `true`
- Exactly one hosted no-body POST: `true`
- Normal no-body route used: `true`
- HTTP status: `200`
- Conversation URL present: `true`
- Provider conversation ID: `cfbad0bafef3e476`
- Tenant ID: `ai-fusion-labs`
- Agent slug: `dani`
- Provider: `tavus`
- `server_side_memory_lookup_attempted=true`
- `server_side_memory_context_applied=true`
- `tavus_conversational_context_attached=true`

## Boundary Flags

- The customer-facing button UI was not changed.
- No Tavus room was joined.
- No Tavus `memory_stores` field was used.
- Memory was not placed in `custom_greeting`.
- No webhook was added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory call was made.
- No actual room URL, prompt text, memory summary, hashes, namespaces, backend IDs, transcript, content, messages, or Tavus API key were stored.

## Evidence

- Redacted proof artifact: `docs/proofs/hermes_tavus_hosted_normal_route_memory_start_t25_safe_capture.json`
- Local T24 implementation doc: `docs/HERMES_NORMAL_SITE_SERVER_SIDE_MEMORY_INJECTION_T24.md`
- Local T24 test: `tests/hermes-normal-site-server-side-memory-injection-t24.test.mjs`

## Next Required Action

Recover the room URL for provider conversation `cfbad0bafef3e476` without storing the URL in repo artifacts, then manually join that hosted-created normal-route conversation and evaluate whether Dani behaves as if she has remembered context.
