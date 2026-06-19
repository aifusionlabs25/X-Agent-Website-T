# Hermes Tavus Memory Prompt Preview

Phase T13 adds a disabled-by-default Tavus prompt memory-context preview for Dani.

It consumes the Phase T12 memory context fixture:

- `tests/fixtures/hermes-next-session-context-preview-dani.json`

This phase shows the exact safe prompt/context block that could later be attached to Dani's Tavus conversation start. It does not mutate `/api/conversation/start`, does not inject memory into a live Tavus conversation, and does not call Tavus, Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflows, production DB, or production memory persistence.

## Internal Route

Route:

- `POST /api/xagent/tavus-memory-prompt-preview/dry-run`

Required gates:

- `XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED=true`
- `XAGENT_DANI_MEMORY_PROMPT_PILOT_ENABLED=true`
- `XAGENT_TAVUS_MEMORY_PROMPT_KILL_SWITCH=false`

With gates closed, the route refuses before shaping a prompt preview.

## Prompt Rules

The candidate prompt context is intentionally conservative:

- It is internal continuity context.
- Dani may use it only as quiet background.
- Dani must not claim emails, CRM updates, purchases, hidden persistence, or external actions.
- Dani must not reveal hashes, namespaces, IDs, or backend machinery.
- Dani must not say "I remember everything" or imply surveillance.
- Dani may naturally continue from prior goals/preferences if relevant.
- Dani should ask for confirmation before acting on prior context.

The prompt text is checked so backend identifiers, hashes, namespaces, and provenance IDs are not exposed in `candidate_tavus_prompt_context`.

## Preview Output

The dry-run response includes:

- `dry_run_only=true`
- `prompt_preview_only=true`
- `agent_slug=dani`
- `visitor_id`
- `next_session_id`
- `prior_memory_record_ids`
- `candidate_tavus_prompt_context`
- `allowed_use`
- `forbidden_use`
- `provenance`
- `tavus_prompt_injection_performed=false`
- `conversation_start_mutated=false`
- `live_tavus_called=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `outbound_action_taken=false`

## Boundary

This phase does not modify `/api/conversation/start`. The next decision is whether to wire this prompt-context block into `/api/conversation/start` behind disabled-by-default gates.
