# Hal Hermes Active Runtime

Purpose: make Hal's production backend status easy to verify without reading source code or guessing which Dani-era switches are still carrying the load.

## Active Means

Hal is considered Hermes-active only when all of these are true:

- Tavus start flow can inject returning-user memory context.
- Tavus post-session transcription callbacks can be accepted.
- Hermes memory operator can write the approved memory record.
- Hermes email/action operator can prepare the three post-session artifacts.
- AgentMail can send through Hal's own inbox.
- Upstash-backed action ledger and operator receipts are available.
- Hal operator dashboard storage is enabled.

The runtime readiness endpoint is:

```text
/api/hal/runtime-readiness
```

Expected active signal:

```json
{
  "agent_slug": "hal",
  "hal_hermes_active": true,
  "hal_hermes_active_status": "active"
}
```

## Required Vercel Variables

Add these in the `x-agent-website-t` Vercel project under `Settings -> Environment Variables`. Use Production for the live site and Preview for branch previews.

```env
HAL_TAVUS_PERSONA_ID=
HAL_TAVUS_REPLICA_ID=
HAL_TAVUS_CUSTOM_GREETING=
TAVUS_API_KEY=
XAGENT_TAVUS_CALLBACK_TOKEN=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
XAGENT_EMAIL_IDENTITY_SALT=

XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true
XAGENT_HAL_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false

XAGENT_EMAIL_MEMORY_STORE_ENABLED=true
XAGENT_HAL_EMAIL_MEMORY_STORE_PILOT_ENABLED=true
XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH=false

XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_ENABLED=true
XAGENT_HAL_EMAIL_OUTBOUND_CONTACT_STORE_PILOT_ENABLED=true
XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_KILL_SWITCH=false

XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED=true
XAGENT_HAL_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED=true
XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH=false

XAGENT_HERMES_MEMORY_OPERATOR_ENABLED=true
XAGENT_HAL_HERMES_MEMORY_OPERATOR_PILOT_ENABLED=true
XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH=false
XAGENT_HERMES_MEMORY_OPERATOR_MODE=embedded

XAGENT_HERMES_EMAIL_ACTIONS_ENABLED=true
XAGENT_HAL_HERMES_EMAIL_ACTIONS_PILOT_ENABLED=true
XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH=false
XAGENT_HERMES_EMAIL_ACTIONS_MODE=draft_only
XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER=agentmail

XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED=true
XAGENT_HAL_AGENTMAIL_ADAPTER_PILOT_ENABLED=true
XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH=false
XAGENT_HAL_AGENTMAIL_ADDRESS=hermes-hal@agentmail.to
HAL_AGENTMAIL_API_KEY=

XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED=true
XAGENT_HAL_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED=true
XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH=false
XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE=live
XAGENT_HAL_HERMES_EMAIL_ADMIN_RECIPIENT=
XAGENT_HAL_OPERATOR_KILL_SWITCH=false
```

## Safe Verification Loop

1. Redeploy the Vercel project after env changes.
2. Open `https://x-agent-website-t.vercel.app/api/hal/runtime-readiness`.
3. Confirm `hal_hermes_active` is `true`.
4. Run one Hal session from `https://x-agent-website-t.vercel.app/hal` with your own email.
5. End the Tavus session and wait for the transcript callback.
6. Check `https://x-agent-website-t.vercel.app/admin/hal-operator` for the memory/write/send receipts.
7. Confirm the user follow-up, lead intel, and admin summary emails arrived.

## Safety Boundary

This active backend still does not claim live Zoom/Teams presence, calendar execution, CRM execution, private Google Drive access, or Brian impersonation. Hal can say an action happened only when the provider receipt exists. Otherwise the language stays "prepared", "queued", "drafted", or "pending review".
