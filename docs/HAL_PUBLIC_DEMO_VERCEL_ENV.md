# Hal Public Demo Vercel Environment Checklist

Purpose: add Hal beside Dani on the existing `x-agent-website-t` deployment without breaking Dani or mixing memory between agents.

## Add These For Hal

Add these in the Vercel project settings for Preview first, then Production after the preview works:

```env
HAL_TAVUS_PERSONA_ID=
HAL_TAVUS_REPLICA_ID=
HAL_TAVUS_CUSTOM_GREETING=Hi, I am Hal. What should we think through together?
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
XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH=false
XAGENT_EMAIL_MEMORY_STORE_ENABLED=true
XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED=true
XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH=false
```

The `DANI` names above are the existing shared pilot gates. Hal separation happens in the stored identity namespace and Redis keys with `agent_slug=hal`.

## Do Not Add For This Public Demo

Do not add AgentMail or outbound-action keys for Hal yet. The Hal webhook path is memory-only for this demo and skips email/action sending.

## Vercel Steps

1. Open the Vercel project for `x-agent-website-t`.
2. Go to `Settings -> Environment Variables`.
3. Add the three Hal variables above to `Preview`.
4. Deploy the branch preview.
5. Open `/hal` on the preview URL and run one short session.
6. End the session, wait for the Tavus transcript callback, then start again with the same email to confirm continuity.
7. Only after the preview works, copy the same Hal variables to `Production`.

## Safety Claim For Hassaan

This demo shows a public Tavus-backed Hal concept with email-keyed memory continuity. It does not claim Brian impersonation, private Google Drive ingestion, Zoom/Teams meeting presence, or completed outbound actions.
