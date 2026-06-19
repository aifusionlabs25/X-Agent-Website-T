# Hermes Return-Code Normal Start Integration T28

Phase T28 wires the T27 return-code memory lookup preview into the normal `/api/conversation/start` server-side memory resolver.

No live Tavus call is made. No Tavus conversation is created. No Tavus room is joined. No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory behavior is added or called.

## Product Model

Each Tavus session is new. A returning visitor should be resolved by an app-owned identity such as a return code, email, or future account identity. The resolved memory is converted into safe Dani continuity context and attached to the new Tavus conversation through `conversational_context`.

T28 keeps this behind gates and does not change the customer-facing UI.

## Current Public UI

`components/TavusPlayer.tsx` remains unchanged:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

The customer-facing button still sends no request body.

## Integration Point

The route already parses an optional JSON body before creating the Tavus conversation:

```text
app/api/conversation/start/route.ts
```

The server-side resolver is:

```text
lib/xagent/serverSideMemoryContextResolver.mjs
```

T28 extends that resolver so an optional `return_code` or `returnCode` field can be handled before Tavus `createConversation`.

## Gate Behavior

Memory injection still requires the existing Tavus memory gates:

```text
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true
XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false
```

Return-code lookup additionally requires:

```text
XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH=false
```

Normal no-body fixture lookup remains controlled by the T24 gates:

```text
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH=false
```

## Behavior Matrix

No request body:

- T24 behavior remains unchanged.
- If normal-site fixture gates are open, local fixture memory can be resolved.
- If gates are closed, no memory is attached.

Valid `return_code` supplied:

- If return-code gates are open, local return-code proof-store memory is resolved.
- The resolved memory feeds the existing safe conversation-start memory shaping.
- Safe `conversational_context` can be attached to the Tavus create body.
- The route response returns only safe memory flags.

Invalid `return_code` supplied:

- If return-code gates are open, validation fails before Tavus `createConversation`.
- The route returns the existing safe invalid-memory 400 response.
- No Tavus request is made.

`return_code` supplied while return-code gates are closed:

- The return code is ignored.
- No return-code lookup runs.
- No memory is attached from the T24 fixture as a fallback for that coded request.

## Safety Boundaries

The route response must not include:

- prompt text
- recalled memory summary
- transcript/content/messages
- hashes
- namespaces
- backend ids
- Tavus API key

T28 does not:

- use Tavus `memory_stores`
- put memory into `custom_greeting`
- call live Tavus in tests
- call Hermes
- call OpenAI/Codex
- call Ollama
- send email through Resend
- write production database or production memory
- change the customer-facing button UI

## Validation

Focused test:

```powershell
npm run test:hermes-return-code-normal-start-integration-t28
```

The test proves:

- no-body T24 behavior remains unchanged
- return-code lookup is disabled by default
- valid return code can resolve safe memory context for route-level start behavior
- invalid return code rejects before Tavus create-conversation
- `TavusPlayer` remains unchanged
- `custom_greeting` remains unchanged
- `memory_stores` is absent
- route responses do not leak memory internals
- no live service fetch occurs

## Next Phase

The next phase should be either:

- a small private return-code test UI, still gated and not public; or
- a hosted dry-run proof that exercises only the safe return-code lookup path without creating a Tavus conversation.

Do not roll this into the public customer UI until a separate approval says to do so.
