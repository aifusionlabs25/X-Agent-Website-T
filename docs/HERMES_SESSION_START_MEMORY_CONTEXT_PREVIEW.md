# Hermes Session-Start Memory Context Preview

Phase T12 adds a disabled-by-default Dani session-start memory context preview to `x-agent-website-t`.

It uses the Phase 49 recall shape proven in `tavus-xlink-hub` as the contract reference and stores a local test fixture at:

- `tests/fixtures/hermes-next-session-context-preview-dani.json`

This is a preview-only path. It does not inject recalled memory into the live Tavus persona, system prompt, conversation start request, or turn loop.

## Internal Route

Route:

- `POST /api/xagent/session-start-context/dry-run`

Required gates:

- `XAGENT_MEMORY_CONTEXT_PREVIEW_ENABLED=true`
- `XAGENT_DANI_MEMORY_CONTEXT_PILOT_ENABLED=true`
- `XAGENT_MEMORY_CONTEXT_KILL_SWITCH=false`

With gates closed, the route refuses before parsing and shaping request content.

## Validation

The helper validates:

- `agent_slug=dani`
- `tenant_id=ai-fusion-labs`
- `visitor_id`
- `visitor_memory_namespace`
- `next_session_id`
- non-empty `prior_memory_record_ids`
- `recalled_memory_summary`
- `confidence`
- `provenance.summary_hash`
- `provenance.record_hash`
- provenance verification flags
- absence of raw transcript, content, messages, and turn payload fields
- absence of outbound/action claims

The summary hash is recomputed from the recalled summary before the preview is accepted.

## Preview Output

The dry-run response includes:

- `dry_run_only=true`
- `memory_context_preview_enabled=true`
- `agent_slug=dani`
- `visitor_id`
- `next_session_id`
- `visitor_memory_namespace`
- `prior_memory_record_ids`
- `recalled_memory_summary`
- `allowed_use`
- `forbidden_use`
- `provenance`
- `tavus_prompt_injection_performed=false`
- `live_tavus_called=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `outbound_action_taken=false`

## Boundary

This phase does not modify `/api/conversation/start`, does not alter the live Tavus join flow, does not call Hermes, and does not add production memory persistence. The next decision is whether to create a disabled prompt-injection preview showing exactly how Dani would use recalled memory in a future Tavus session.
