# Hermes Public Email Memory Check-In T40

Phase T40 adds the first public-facing memory check-in step before Dani creates a Tavus room.

This is not a password login and it does not create an account. It is an optional check-in that lets a visitor share a name and email before the session starts. Email is used as the future returning-user identity trigger; a visitor can also start fresh.

## Product Behavior

When a visitor launches Dani through the existing public surfaces, `TavusPlayer` now shows a memory check-in panel before creating a Tavus conversation.

The visitor can choose:

- **Continue with memory**: validates email shape locally and sends the email to `/api/conversation/start` so the server can resolve approved memory before Tavus starts.
- **Start fresh**: sends an explicit fresh-start signal so no memory lookup or proof fixture fallback is used.

The public customer-facing launch buttons are still the same buttons. The change happens inside the full-screen Tavus player before the room is created.

## Request Shapes

Continue with memory:

```json
{
  "email": "visitor supplied email",
  "display_name": "optional visitor supplied name"
}
```

Start fresh:

```json
{
  "skip_memory": true,
  "memory_mode": "fresh"
}
```

The email value is sent only to the server start route. It must not be echoed into route responses, proof artifacts, Tavus prompt text, or logs.

## Server Safety

`lib/xagent/serverSideMemoryContextResolver.mjs` now treats explicit fresh-start requests as no-memory starts, even if older proof fixture gates are open.

If a valid email has no approved memory yet, the server starts fresh instead of failing the Tavus session. This supports first-time visitors who choose to share an email before any memory exists.

Invalid email shape still rejects safely before Tavus `createConversation` when email lookup gates are open.

## Boundaries

T40 does not add:

- production memory storage
- raw email persistence
- raw transcript storage
- Hermes dispatch
- OpenAI/Ollama calls
- Resend/email sending
- outbound workflow actions
- Tavus `memory_stores`
- memory in `custom_greeting`

## Feature Flag

The client check-in can be disabled at build time with:

```text
NEXT_PUBLIC_XAGENT_EMAIL_MEMORY_CHECKIN_ENABLED=false
```

When omitted, the check-in is enabled.

## Validation

```powershell
npm run test:hermes-public-email-memory-checkin-t40
npm run test:hermes-email-normal-start-integration-t37
npm run test:hermes-normal-site-server-side-memory-injection-t24
npm run lint
npx tsc --noEmit
npm run build
```
