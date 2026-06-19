# Hermes Tavus Manual Transcript Dry-Run Runbook

Status: controlled manual live-test plan only. Do not run this without explicit human approval.

This runbook describes how to perform one future manual live Tavus transcript retrieval dry-run for Dani. It uses the disabled internal path proven by T4:

1. Start from an app-owned Dani session identity.
2. Use a real completed Tavus `provider_conversation_id`.
3. Retrieve the completed transcript from Tavus with `GET /v2/conversations/{conversation_id}?verbose=true`.
4. Extract `application.transcription_ready` from `events[]`.
5. Build an `xagent.session.completed` Hermes dry-run payload preview.

## What This Does

- Calls Tavus `GET https://tavusapi.com/v2/conversations/{conversation_id}?verbose=true`.
- Reads `application.transcription_ready -> properties.transcript[]`.
- Normalizes Tavus `assistant` turns to Hermes `agent` turns.
- Excludes Tavus `system` and `tool` transcript turns from Hermes memory input and reports drop counts.
- Redacts sensitive transcript content before returning the payload preview.
- Returns a dry-run Hermes payload preview only.

## What This Does Not Do

- It does not call Hermes.
- It does not call OpenAI, Codex, or Ollama.
- It does not send email or use Resend.
- It does not write to a production database.
- It does not dispatch outbound workflows.
- It does not register a Tavus webhook.
- It does not create or use `/api/webhook`.
- It does not persist visitor memory.

## Required Approval and Inputs

Before running, a human operator must explicitly approve this single live Tavus retrieval test.

Required values:

- `provider_conversation_id`: a real completed Dani Tavus conversation ID.
- `tenant_id`: `ai-fusion-labs`.
- `agent_slug`: `dani`.
- `visitor_id`: app-owned visitor ID for the test.
- `session_id`: app-owned X Agent session ID for the test.
- `provider`: `tavus`.
- `TAVUS_API_KEY`: present in the shell environment.
- `XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED=true`.
- `XAGENT_ALLOW_LIVE_TAVUS_TRANSCRIPT_TEST=true`.

## Command

Run from the repo root after explicit approval:

```powershell
$env:XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED = "true"
$env:XAGENT_ALLOW_LIVE_TAVUS_TRANSCRIPT_TEST = "true"
$env:TAVUS_API_KEY = "<real Tavus API key>"
npm run hermes:manual-tavus-transcript-dry-run -- <completed_conversation_id>
```

Optional env overrides:

```powershell
$env:XAGENT_MANUAL_TEST_VISITOR_ID = "visitor_manual_001"
$env:XAGENT_MANUAL_TEST_SESSION_ID = "xagent_session_manual_001"
$env:XAGENT_MANUAL_TEST_COMPLETED_AT = "2026-06-18T21:03:00Z"
```

## Expected Output

The script prints a redacted summary only:

- event type
- tenant, agent, visitor, session, provider, provider conversation ID
- transcript hash
- memory namespace
- visitor memory namespace
- idempotency key
- allowed operations
- dry-run and no-dispatch flags
- redacted transcript turn count
- source turn count and excluded system/tool turn count

Raw transcript content is not printed by default.

## Stop Conditions

Stop and do not retry automatically if:

- the conversation is not completed
- `application.transcription_ready` is missing
- transcript content is malformed
- Tavus returns a non-200 response
- any namespace, tenant, agent, visitor, or session value is wrong
- the output suggests Hermes dispatch, OpenAI/Ollama use, email, DB persistence, or outbound action

## Next Decision

After this runbook is reviewed, the next decision is whether to approve exactly one controlled manual live retrieval test with a real completed Dani `provider_conversation_id`, or keep the entire path mocked.
