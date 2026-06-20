# Hermes Email Memory Store T41

Phase T41 adds the first production-shaped returning-user memory loop for Dani on `x-agent-website-t`.

## What It Adds

- `/api/conversation/start` can write a safe conversation-to-email-hash mapping when the visitor starts with email.
- `/api/webhook` can receive Tavus `application.transcription_ready` callbacks.
- The webhook filters user/assistant transcript turns, creates a redacted deterministic memory summary, and stores only the safe memory record.
- A later email check-in can read that stored memory and attach it to the new Tavus conversation through `conversational_context`.

## Durable Store

The first durable adapter uses Upstash Redis REST with:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

It is disabled unless all gates are open:

- `XAGENT_EMAIL_MEMORY_STORE_ENABLED=true`
- `XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED=true`
- `XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH=false`
- `XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED=true`
- `XAGENT_DANI_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED=true`
- `XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH=false`
- `XAGENT_EMAIL_IDENTITY_SALT=<non-fixture private salt>`
- optional but recommended: `XAGENT_TAVUS_CALLBACK_TOKEN=<private callback token>`

## Boundaries

T41 does not:

- store raw email
- store normalized email
- store raw transcript
- call Hermes Gateway
- call OpenAI/Codex
- call Ollama
- send Resend email
- perform outbound workflows
- use Tavus `memory_stores`
- put memory in `custom_greeting`

## Known Limitation

The memory summary is deterministic and local to the website repo. It is production-shaped, but it is not yet a live Hermes/Ollama summarization lane. A future phase can replace the deterministic summarizer with the Hermes backend worker once the durable store path is stable.

## Validation

```bash
npm run test:hermes-email-memory-store-t41
npm run test:hermes-tavus-transcription-memory-webhook-t41
```
