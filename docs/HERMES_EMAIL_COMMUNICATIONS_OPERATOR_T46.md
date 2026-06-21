# Hermes Email Communications Operator T46

Phase T46 adds the first provider-neutral Hermes communications action family for Dani.

This phase is draft-only. It does not send email, call Resend, call AgentMail, create an AgentMail inbox, call Hermes Gateway, call OpenAI/Codex, call Ollama, create a Tavus conversation, join a Tavus room, update CRM, register webhooks, or mutate production memory beyond the existing T45 memory path.

## Goal

The X Agent should not own backend email work directly. Dani can collect consent and context during the live session. Hermes owns the post-session communications workflow.

The first approved action family is:

- `email.user_followup`
- `email.admin_summary`
- `email.lead_intel`

T46 produces draft action plans only. It records that no provider was called and that Dani must not claim an email was sent.

## Runtime Placement

The Tavus transcript callback flow is now:

1. Tavus sends `application.transcription_ready` to `/api/webhook`.
2. `runHermesEmailMemoryOperator()` summarizes the transcript and stores the email-identity memory record.
3. `runHermesEmailCommunicationsOperator()` optionally creates a draft-only communications plan.
4. The webhook response exposes only safe status/count fields, not draft bodies.

## Gates

Draft planning is disabled unless all three gates are open:

- `XAGENT_HERMES_EMAIL_ACTIONS_ENABLED=true`
- `XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED=true`
- `XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH=false`

Mode and provider are explicit:

- `XAGENT_HERMES_EMAIL_ACTIONS_MODE=draft_only`
- `XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER=none|resend|agentmail`

`send` mode is recognized but blocked. Runtime readiness reports `hermes_email_actions_send_mode_requested=true`, while `hermes_email_actions_live_send_enabled=false` until a provider adapter is separately approved.

## AgentMail Position

AgentMail is a strong candidate for a replyable X Agent inbox, not the first live send dependency.

Recommended Dani inbox settings:

- username: `dani-xagent`
- display name: `Dani X Agent SDR`
- domain: `agentmail.to` until a custom AI Fusion Labs domain is approved

T46 does not call AgentMail or create the inbox. It only records the provider recommendation.

Recommended provider split:

- first controlled outbound send: Resend
- replyable agent inbox and future inbound-thread workflows: AgentMail

## Safety Boundaries

The communications operator keeps these constraints:

- post-session only
- not part of the live Tavus turn loop
- no live email send
- no provider API call
- no raw email available to the email action layer
- no raw transcript stored in the plan
- operator review required before send
- no completed-action claim allowed

The webhook response reports:

- `hermes_email_actions_attempted`
- `hermes_email_actions_planned`
- `hermes_email_actions_status`
- `hermes_email_action_count`
- `hermes_email_draft_count`
- `hermes_email_send_count`
- `agentmail_called=false`
- `resend_called=false`
- `outbound_action_taken=false`
- `action_claim_allowed=false`

## Next Steps

T47 should add a provider adapter design, still no live send. The safest path is:

1. Define the Resend and AgentMail adapter contracts.
2. Keep Resend as the first outbound send candidate.
3. Keep AgentMail as the replyable inbox candidate.
4. Add idempotency and action ledger requirements before any send.
5. Approve one controlled live send only after the action ledger is in place.

## Validation

```powershell
npm run test:hermes-email-communications-operator-t46
npm run test:hermes-tavus-transcription-memory-webhook-t41
npm run test:hermes-runtime-readiness
npm run test:hermes-email-memory-operator-t45
npm run lint
npx tsc --noEmit
npm run build
```
