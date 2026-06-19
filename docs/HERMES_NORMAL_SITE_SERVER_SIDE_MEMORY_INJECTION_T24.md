# Hermes Normal-Site Server-Side Memory Injection T24

Phase T24 adds disabled-by-default server-side memory lookup for the normal Dani website start flow.

## Purpose

The normal customer-facing button still starts Dani through `TavusPlayer`, and `TavusPlayer` still sends:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

No public UI change is required, and the public button does not need to send `memory_context`.

## Gates

Server-side normal-site memory lookup requires both the existing Tavus memory injection gates and the new normal-site lookup gates:

- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true`
- `XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true`
- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false`
- `XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED=true`
- `XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED=true`
- `XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH=false`

With any gate closed:

- no server-side memory lookup runs
- no fixture is loaded
- no request body is required
- no `conversational_context` is attached
- the existing no-memory `createConversation` behavior remains unchanged

## Local Fixture Source

The resolver uses a local fixture/proof-store style source only:

- default fixture: `tests/fixtures/hermes-next-session-context-preview-dani.json`

There is no production database lookup, no production memory persistence, and no Hermes call in this phase.

## Route Behavior

`app/api/conversation/start/route.ts` still supports supplied `memory_context` from the T16 harness path. T24 adds a fallback for normal no-body starts:

1. If a request supplies memory context, the supplied-body validation path remains authoritative.
2. If no memory context is supplied and all normal-site lookup gates are open, the route resolves Dani memory from the local fixture.
3. The validated context is shaped by the existing T12/T13/T16 helpers.
4. Only the safe prompt block is passed to Tavus as `conversational_context`.
5. The API response returns only safe memory flags and app-owned session identity.

The response must not expose prompt text, recalled memory summary, hashes, namespaces, backend IDs, transcript content, or messages.

## Safety Boundaries

- No live Tavus call is made in tests.
- No Tavus `memory_stores` field is used.
- Memory is not placed in `custom_greeting`.
- No webhook is added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory behavior is added.
- Existing no-body public button behavior remains unchanged while gates are closed.

## Validation

Focused test:

```powershell
npm run test:hermes-normal-site-server-side-memory-injection-t24
```

The test proves:

- gates closed preserves no-memory behavior
- gates open lets a normal no-body start attach server-side Dani memory context
- `TavusPlayer` still sends no request body
- route responses do not leak memory/prompt/backend details
- `custom_greeting` remains unchanged
- `memory_stores` is absent
- no live service fetch occurs

## Next Decision

After commit, push, and Vercel redeploy, the next phase should perform one controlled hosted normal-route proof: start through the normal no-body `/api/conversation/start` path with the new gates open, capture only safe response fields, and verify `tavus_conversational_context_attached=true`.
