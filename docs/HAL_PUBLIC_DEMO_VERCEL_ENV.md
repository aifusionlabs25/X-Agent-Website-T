# Hal Public Demo Vercel Environment Checklist

Purpose: add Hal beside Dani on the existing `x-agent-website-t` deployment without breaking Dani or mixing memory between agents.

## Add These For Hal

Add these in the Vercel project settings for Preview first, then Production after the preview works:

```env
HAL_TAVUS_PERSONA_ID=
HAL_TAVUS_REPLICA_ID=
HAL_TAVUS_CUSTOM_GREETING=Hey, I'm Hal. Good to meet you - what are you working through today and how can I assist?
```

Optional:

```env
HAL_DOC_RETRIEVAL_STRATEGY=speed
HAL_DOCUMENT_TAG=hal-core
```

## Reused Existing Values

Hal intentionally reuses the existing Dani website infrastructure:

```env
TAVUS_API_KEY=
XAGENT_TAVUS_CALLBACK_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
XAGENT_EMAIL_IDENTITY_SALT=
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true
XAGENT_HAL_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH=false
XAGENT_EMAIL_MEMORY_STORE_ENABLED=true
XAGENT_HAL_EMAIL_MEMORY_STORE_PILOT_ENABLED=true
XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH=false
XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_ENABLED=true
XAGENT_HAL_EMAIL_OUTBOUND_CONTACT_STORE_PILOT_ENABLED=true
XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_KILL_SWITCH=false
```

The older `DANI` pilot names remain supported as a temporary fallback for existing deployments. New Hal deployments should use the explicit `HAL` pilot names above so the setup is readable in Vercel.

## Add These For Hal AgentMail

Add these only when Hal post-session email follow-up should be available. Keep the mode in `live` only when you are ready for real AgentMail sends after Tavus transcript callbacks.

```env
XAGENT_HERMES_EMAIL_ACTIONS_ENABLED=true
XAGENT_HAL_HERMES_EMAIL_ACTIONS_PILOT_ENABLED=true
XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH=false
XAGENT_HERMES_EMAIL_ACTIONS_MODE=draft_only
XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER=agentmail

XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED=true
XAGENT_HAL_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED=true
XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH=false

XAGENT_HERMES_MEMORY_OPERATOR_ENABLED=true
XAGENT_HAL_HERMES_MEMORY_OPERATOR_PILOT_ENABLED=true
XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH=false
XAGENT_HERMES_MEMORY_OPERATOR_MODE=embedded

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
AGENTMAIL_API_BASE_URL=https://api.agentmail.to
XAGENT_HAL_OPERATOR_KILL_SWITCH=false
```

Do not put `HAL_AGENTMAIL_API_KEY` in source code, docs, screenshots, or client-side `NEXT_PUBLIC_` variables. It belongs only in `.env.local` for local testing and Vercel Environment Variables for hosted deployments.

## Vercel Steps

1. Open the Vercel project for `x-agent-website-t`.
2. Go to `Settings -> Environment Variables`.
3. Add the Hal Tavus variables above to `Preview`.
4. Deploy the branch preview.
5. Open `/hal` on the preview URL and run one short session.
6. End the session, wait for the Tavus transcript callback, then start again with the same email to confirm continuity.
7. If memory works and you want real Hal email sends, add the Hal AgentMail variables to `Preview`.
8. Run one controlled follow-up test with your own email and confirm an AgentMail receipt.
9. Check `/api/hal/runtime-readiness`; it should show `hal_hermes_active: true` when the full Hermes path is wired.
10. Only after the preview works, copy the same Hal variables to `Production`.

## Safety Claim For Hassaan

This demo shows a public Tavus-backed Hal concept with email-keyed memory continuity and gated post-session AgentMail follow-up. It does not claim Brian impersonation, private Google Drive ingestion, Zoom/Teams meeting presence, or completed outbound actions unless the backend send receipt confirms the action.
