# Hermes Dani Session Experience T56

Phase T56 adds two website experience layers around Dani:

1. Dani Live Notes Panel
2. Dani Post-Session Results Page

This phase works only in `x-agent-website-t`. It does not touch `tavus-xlink-hub`, X-LINK, or Anam.ai. It does not call live Tavus in tests, call Hermes Gateway, OpenAI/Codex, Ollama, Resend, AgentMail, Calendly API, CRM, outbound workflows, or production databases. It does not use Tavus `memory_stores` and does not put memory into `custom_greeting`.

## Live Notes Panel

The live notes panel appears inside the Dani Tavus experience as a polished companion surface. It shows safe session cues only:

- visitor display name when supplied
- memory state
- business-context placeholder
- current use-case placeholder
- requested next-step placeholder
- meeting or email handoff availability
- preferred handoff channel
- open questions
- status chips such as notes active, memory on, and follow-up available

It is intentionally not a live transcript panel. Until a real streaming transcript/event source exists, the panel uses existing session, memory check-in, and conversation-start state. It must not expose raw email, transcript internals, hashes, namespaces, backend IDs, API keys, room URLs, hidden prompts, or Tavus payload internals.

## Post-Session Results Page

When the visitor ends or leaves the session, the Tavus overlay now transitions into a post-session results screen instead of disappearing immediately.

The results page shows safe post-session states:

- session processing or processed status
- follow-up request captured, plan prepared, or email sent only when backend status confirms it
- admin/operator summary status
- memory pending, used, or ready
- scheduling CTA
- disabled recap download state when no safe recap artifact exists
- continuation note for using the same email next time
- confirmation boundary explaining that actions are confirmed only by backend status

The page may query the existing safe email-action status route using the provider conversation ID internally, but it does not render that ID. If status lookup is missing or unavailable, the UI stays in safe pending states.

## Safety Rules

- No raw email display.
- No provider conversation ID display.
- No room URL display.
- No transcript, prompt text, hash, namespace, or backend ID display.
- No claim that email was sent unless backend status confirms it.
- No claim that a meeting was booked unless backend status confirms it.
- No claim that CRM, calendar, or memory persistence completed unless backend status confirms it.
- No new heavy dependency.

## Validation

Run:

```bash
npm run test:hermes-dani-session-experience-t56
npm run test:hermes-tavus-memory-injection
npm run test:hermes-tavus-memory-prompt-preview
npm run lint
npx tsc --noEmit
npm run build
```
