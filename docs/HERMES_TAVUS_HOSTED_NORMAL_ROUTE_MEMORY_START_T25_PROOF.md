# Hermes Tavus Hosted Normal-Route Memory Start T25 Proof

Phase T25 was intended to verify the redeployed production site and then run one hosted normal no-body `/api/conversation/start` POST.

The live hosted POST was not attempted because the deployment precondition failed.

## Pre-Live Result

- Production deployed commit: `862c359`
- Local `HEAD`: `862c359`
- Local T24 normal-site memory lookup changes are still uncommitted in this workspace.
- Production T24 code confirmed: `false`
- Runtime readiness endpoint was reachable and returned the base T16/T20 readiness fields.
- Production six memory gates were confirmed present, non-empty, and matching the required true/true/false plus true/true/false values.

Because production is still serving commit `862c359` and the T24 route/resolver changes are local dirty worktree changes, the hosted site cannot yet prove the normal-site server-side memory lookup path.

## Hosted POST Status

- Hosted start URL: `https://x-agent-website-t.vercel.app/api/conversation/start`
- Hosted no-body POST attempted: `false`
- Exactly one hosted no-body POST: `false`
- Normal no-body route used: `false`
- New Tavus conversation created: `false`
- Tavus room joined: `false`
- `server_side_memory_lookup_attempted=false`
- `server_side_memory_context_applied=false`
- `tavus_conversational_context_attached=false`

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

Commit and push the T24 normal-site server-side memory lookup implementation, wait for Vercel production to deploy that commit, then rerun T25. Only after production is serving T24 should one hosted no-body POST be attempted.
