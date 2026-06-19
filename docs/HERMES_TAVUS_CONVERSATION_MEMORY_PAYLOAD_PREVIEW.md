# Hermes Tavus Conversation Memory Payload Preview

Phase T15 updates the disabled-by-default Tavus conversation-start memory payload preview for Dani so the future context field is `conversational_context`.

It composes:

- the current local Tavus conversation-start body shape from `lib/tavus.ts`
- the Phase T13 `candidate_tavus_prompt_context`
- `conversational_context` containing the Phase T13 `candidate_tavus_prompt_context`

This phase does not call Tavus and does not modify `/api/conversation/start`.

## Internal Route

Route:

- `POST /api/xagent/tavus-conversation-memory-payload-preview/dry-run`

Required gates:

- `XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED=true`
- `XAGENT_DANI_MEMORY_PAYLOAD_PILOT_ENABLED=true`
- `XAGENT_TAVUS_MEMORY_PAYLOAD_KILL_SWITCH=false`

With gates closed, the route refuses before building the payload preview.

## Current Tavus Body Shape

The preview mirrors the current local request body shape:

- `persona_id`
- `replica_id`
- `custom_greeting`
- optional `callback_url`
- `properties.max_call_duration`
- `properties.participant_absent_timeout`
- `properties.participant_left_timeout`

The memory prompt is not placed into `custom_greeting` or any live route. It is shown in preview as `candidate_create_conversation_body_preview.conversational_context`.

## Attachment Strategy

The Tavus official docs/OpenAPI identify `conversational_context` as the correct preview field for this lane.

The preview uses:

- `memory_attachment_strategy=official_conversational_context_preview`
- `tavus_official_memory_field_verified=true`
- `candidate_create_conversation_body_preview.conversational_context`

`memory_stores` is intentionally not used yet because this lane is proving app-owned Hermes memory, not Tavus-native memory.

## Preview Output

The dry-run response includes:

- `dry_run_only=true`
- `payload_preview_only=true`
- `agent_slug=dani`
- `candidate_tavus_prompt_context`
- `candidate_create_conversation_body_preview`
- `memory_attachment_strategy`
- `tavus_create_conversation_called=false`
- `conversation_start_route_mutated=false`
- `tavus_prompt_injection_performed=false`
- `live_tavus_called=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `outbound_action_taken=false`

## Boundary

This phase does not change the live Tavus join flow, does not inject memory into a live Tavus conversation, does not add webhooks, and does not call any live/model/outbound/DB system.

The next decision is whether to wire this payload into `/api/conversation/start` behind disabled-by-default gates.
