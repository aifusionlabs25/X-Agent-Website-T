# Hermes Tavus Live Transcript Dry-Run Proof

Status: redacted repo-local proof artifact. This file intentionally stores no raw transcript content.

## Scope

Phase T8 ran one controlled manual Tavus transcript retrieval dry-run for Dani using:

- `conversation_id=ca4ec4813b2a8413`
- `GET /v2/conversations/ca4ec4813b2a8413?verbose=true`
- existing script: `npm run hermes:manual-tavus-transcript-dry-run -- ca4ec4813b2a8413`

No retry loop was used.

## Result

- `application.transcription_ready` returned: `true`
- Hermes dry-run payload preview built: `true`
- `transcript_turn_count=20`
- `source_turn_count=30`
- `dropped_non_memory_turn_count=10`
- `dropped_non_memory_roles=["system"]`
- `transcript_hash=438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40`
- `memory_namespace=xagents/ai-fusion-labs/dani/visitor_manual_live_tavus_test/xagent_session_manual_live_tavus_test`
- `idempotency_key=phase_t2_xagent_website_t_dani_dry_run_v1:ai-fusion-labs:dani:visitor_manual_live_tavus_test:xagent_session_manual_live_tavus_test:tavus:ca4ec4813b2a8413:summarize_session_for_memory:438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40`
- `allowed_operations=["summarize_session_for_memory"]`

## Boundary Proof

- `dry_run_only=true`
- `hermes_dispatched=false`
- `live_hermes_called=false`
- `codex_openai_escalation=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_backend_mutated=false`
- `production_memory_database_mutated=false`
- `tavus_webhook_required=false`
- `provider_conversation_id_used_for_namespace=false`
- `raw_transcript_content_stored=false`

## Stored Artifact

Summary-only JSON proof:

`docs/proofs/hermes_tavus_live_transcript_dry_run_ca4ec4813b2a8413.json`

The JSON artifact contains only counts, hashes, namespaces, idempotency, and boundary flags. It does not contain raw transcript turns or raw transcript text.

## Next Decision

The next decision is whether to design a disabled internal Hermes dispatch handoff, or keep the app at dry-run preview only.
