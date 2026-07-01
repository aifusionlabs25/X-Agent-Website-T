# Hal Hermes Operator Backend

Status: implemented as a gated production-safe layer on top of the working Hal Tavus memory and AgentMail flow.

## What This Adds

Hal now has a safe operator layer for:

- session artifacts after Tavus transcription-ready callbacks;
- user-scoped memory continuity signal, keyed by the existing email identity hash pattern;
- deterministic post-session operator briefs;
- a human-review action queue for prepared-but-not-confirmed actions;
- capability receipts that say what actually happened;
- a meeting-prep brief builder for supplied context;
- a read-only dashboard at `/admin/hal-operator`.

## What This Does Not Claim

This layer does not:

- impersonate Brian Halligan;
- use Brian private files or private Google Drive content;
- expose raw email addresses in the dashboard;
- expose raw transcripts in the dashboard;
- execute calendar, CRM, Zoom, Teams, or external business actions;
- claim an email, meeting, CRM update, or other external action completed without a stored provider/tool receipt.

## Storage Contract

The operator store reuses the existing Upstash Redis environment:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- existing email memory store gates

Optional kill switch:

```env
XAGENT_HAL_OPERATOR_KILL_SWITCH=true
```

When the kill switch is absent or not `true`, the operator layer is allowed to write only if the existing memory-store gates are open.

## Dashboard

Route:

```text
/admin/hal-operator
```

The dashboard returns only safe operator data:

- recent session counts;
- memory write count;
- AgentMail send count;
- pending human-review action count;
- claim-safe receipt count;
- post-session brief TL;DR;
- receipt statuses.

Raw transcript content, raw email, secrets, and prompt text are intentionally not returned.

## Meeting Prep

Route:

```text
POST /api/hal/operator/prep
```

The route creates a Hal meeting-prep brief from supplied context only. It does not read calendars, emails, private files, or Zoom/Teams content. It stores the brief only when `persist: true` is supplied and the store gates are open.

## Safe Claim Rule

Hal can truthfully say:

- memory was stored only when a `hermes.memory_write` receipt is `completed`;
- an email was sent only when an `agentmail.post_session_send` receipt is `completed`;
- a draft/action is pending only when queue status is `requires_operator_review`.

Anything else should be phrased as proposed, drafted, prepared, or pending.
