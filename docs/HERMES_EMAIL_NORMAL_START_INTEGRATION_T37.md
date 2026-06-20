# Hermes Email Normal Start Integration T37

Phase T37 wires the T36 email identity memory lookup helper into the normal `/api/conversation/start` server-side memory resolver.

This phase stays inside `x-agent-website-t`. It does not edit `tavus-xlink-hub`, touch X-LINK / Anam.ai hub, create a Tavus conversation, call live Tavus, call Hermes, call OpenAI/Codex, call Ollama, call Resend/email, send outbound workflow actions, mutate production database state, mutate production memory, add a webhook, or change public customer-facing UI.

## What Changed

`/api/conversation/start` can now accept one of these optional body hints:

```text
email
returning_email
returningEmail
```

The public `TavusPlayer` remains unchanged and still sends:

```text
fetch('/api/conversation/start', { method: 'POST' })
```

The email hint is handled only server-side by `lib/xagent/serverSideMemoryContextResolver.mjs`.

## Gates

Email memory lookup remains disabled by default and requires:

```text
XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH=false
```

The resulting memory context still requires the existing Tavus memory injection gates:

```text
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true
XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false
```

If email gates are closed, supplied email is ignored and does not trigger lookup or prompt injection.

If email gates are open and the supplied email is invalid, the route rejects safely before Tavus `createConversation` with the existing 400-style memory validation response.

## Resolver Order

The resolver preserves existing behavior:

1. Explicit `memory_context` body wins and is handled by the existing T16 path.
2. Return-code lookup remains unchanged and wins before email lookup.
3. Email identity lookup runs when an email hint is supplied and email gates are open.
4. No-body T24 local fixture lookup remains unchanged when normal-site fixture gates are open.

## Safety

The start route response does not return:

- raw email
- normalized email
- email identity hash
- namespace
- prompt text
- memory summary
- transcript/content/messages
- backend IDs
- API keys
- room URL beyond the existing route behavior

The Tavus request body uses `conversational_context` only when a safe memory context is resolved. This lane does not use Tavus `memory_stores`, and memory is not placed in `custom_greeting`.

## Validation

```powershell
npm run test:hermes-email-memory-lookup-t36
npm run test:hermes-email-normal-start-integration-t37
npm run test:hermes-return-code-normal-start-integration-t28
npm run test:hermes-normal-site-server-side-memory-injection-t24
npm run lint
npx tsc --noEmit
npm run build
```

## Next Phase

The next phase can be a hosted email dry-run proof or a controlled hosted live start with email, only after explicit approval.
