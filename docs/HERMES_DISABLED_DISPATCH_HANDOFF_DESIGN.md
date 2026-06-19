# Hermes Disabled Dispatch Handoff Design

Status: design only. No Hermes dispatch is implemented by this document.

## Proven Input

T9 captured the successful live Tavus transcript dry-run as redacted proof:

- proof note: `docs/HERMES_TAVUS_LIVE_TRANSCRIPT_DRY_RUN_PROOF.md`
- summary JSON: `docs/proofs/hermes_tavus_live_transcript_dry_run_ca4ec4813b2a8413.json`
- conversation id: `ca4ec4813b2a8413`
- retained memory turns: `20`
- source turns: `30`
- dropped non-memory turns: `10`
- transcript hash: `438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40`
- allowed operation: `summarize_session_for_memory`

The T9 artifact is summary-only. It contains no raw transcript turns or raw transcript text.

## Future Handoff Contract

The future Hermes dispatch handoff input is the existing `hermes_backend_payload` produced by `lib/xagent/sessionCompletedPayload.mjs`.

Required payload fields:

- `event_type="xagent.session.completed"`
- `tenant_id="ai-fusion-labs"`
- `agent_slug="dani"`
- `visitor_id`
- `session_id`
- `provider="tavus"`
- `provider_conversation_id`
- `transcript_hash`
- `memory_namespace`
- `visitor_memory_namespace`
- `idempotency_key`
- `allowed_operations=["summarize_session_for_memory"]`
- `requested_operation="summarize_session_for_memory"`
- `operation_phase="post_session"`
- `post_session_only=true`
- `live_loop_dependency=false`

The provider conversation id remains provenance only. It must not be used as the primary memory namespace.

The dispatch handoff must reject the payload when:

- `agent_slug` is not `dani`
- `provider` is not `tavus`
- `allowed_operations` is anything other than exactly `["summarize_session_for_memory"]`
- `requested_operation` is not `summarize_session_for_memory`
- `operation_phase` is not `post_session`
- `post_session_only` is not `true`
- `live_loop_dependency` is not `false`
- `idempotency_key` is missing
- `transcript_hash` is missing
- `memory_namespace` is missing
- `visitor_memory_namespace` is missing
- raw transcript content is requested for dispatch storage
- outbound, email, CRM, calendar, payment, or human follow-up claims are requested

Raw transcript should not be sent to a Hermes worker unless a later phase explicitly approves that behavior. The first handoff design should send summary-only job metadata plus a controlled reference to the redacted payload preview. If a future Hermes worker needs transcript content for summarization, that must be handled as a separate reviewed data-minimization decision.

Operator review remains required before any follow-up, outbound claim, replay-informed next-session context, or human-facing memory use.

## Disabled-By-Default Gates

Future implementation must default to disabled:

- `XAGENT_HERMES_DISPATCH_ENABLED=false`
- `XAGENT_HERMES_DANI_PILOT_ENABLED=false`
- `XAGENT_HERMES_DISPATCH_KILL_SWITCH=true`

Required gate semantics:

- If `XAGENT_HERMES_DISPATCH_ENABLED` is not exactly `true`, do not dispatch.
- If `XAGENT_HERMES_DANI_PILOT_ENABLED` is not exactly `true`, do not dispatch Dani payloads.
- If `XAGENT_HERMES_DISPATCH_KILL_SWITCH` is not exactly `false`, do not dispatch.
- Missing Hermes worker endpoint config must block dispatch.
- Missing local job output directory config must block file handoff.
- Missing idempotency key or transcript hash must block dispatch before any side effect.

No local model path, Hermes worker endpoint, queue backend, or service account should be assumed.

## Dispatch Options

### Option 1: Disabled Local Job-File Handoff

Write a summary-only job request file to a local outbox directory when all gates pass.

Recommended first option.

Why:

- easiest to keep disabled by default
- easiest to inspect before a worker consumes it
- easiest to test without network calls
- avoids assuming a live Hermes endpoint
- avoids production DB persistence
- keeps idempotency and boundary proof visible

Minimum future job file fields:

- `job_type="xagent.session.completed.summarize_session_for_memory"`
- `dispatch_mode="disabled_local_file_handoff"`
- `event_type`
- `tenant_id`
- `agent_slug`
- `visitor_id`
- `session_id`
- `provider`
- `provider_conversation_id`
- `transcript_hash`
- `memory_namespace`
- `visitor_memory_namespace`
- `idempotency_key`
- `allowed_operations`
- `operator_review_required=true`
- `source_proof_path`
- `raw_transcript_included=false`
- `hermes_dispatched=false`
- `outbound_action_taken=false`

The job file should be considered a pending handoff artifact, not proof that Hermes executed anything.

### Option 2: Internal HTTP Call To Hermes Worker

Send the payload to a local or internal Hermes worker endpoint.

Do not use this first. It requires endpoint auth, retry policy, timeout behavior, idempotency storage, and operator visibility before it is safe.

### Option 3: Background Job Queue

Enqueue the payload into a queue backend.

Do not use this first. It requires queue infrastructure, dead-letter handling, status storage, and worker deployment controls.

### Option 4: Direct Module Call

Call a colocated Hermes module directly if Hermes later becomes part of this app runtime.

Do not use this first. It creates tighter coupling and can accidentally blur preview, dispatch, and execution boundaries.

## Required Acceptance Tests Before Implementation

Future implementation must prove:

- disabled by default
- kill switch blocks dispatch
- missing Dani pilot gate blocks dispatch
- wrong agent rejects
- wrong provider rejects
- wrong operation rejects
- missing idempotency key rejects
- missing transcript hash rejects
- missing memory namespace rejects
- missing visitor memory namespace rejects
- raw transcript is not included in the handoff artifact
- provider conversation id remains provenance only
- no outbound, email, CRM, calendar, payment, or human follow-up behavior
- no OpenAI or Codex default path
- no Ollama default path
- no live Tavus call during dispatch
- no live Hermes call unless a later phase explicitly enables the HTTP option
- local job-file handoff remains disabled unless all gates pass
- generated job file claims `hermes_dispatched=false`

## Boundary Statement

T10 adds no dispatch implementation. It only defines the handoff contract and the safest first implementation option.

The next decision is either:

- implement a disabled local job-file handoff skeleton, or
- keep the app at dry-run preview only.
