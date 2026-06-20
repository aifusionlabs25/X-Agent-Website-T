# Hermes Returning-User Memory Product Architecture T26

Phase T26 is a read-only product architecture audit for the real Dani memory model in `x-agent-website-t`.

No live Tavus call was made. No Tavus conversation was created. No Tavus room was joined. No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory behavior was added or called.

## Product Correction

The room URL recovery and manual join path should stay paused. It was useful for checking one created Tavus conversation, but it is not the product memory model.

The real product model is:

1. A first-time visitor starts a new Dani session.
2. The app creates app-owned session identity and a durable visitor identity.
3. After the session, the app retrieves that session transcript and hands it to Hermes.
4. Hermes turns the transcript into an approved memory candidate.
5. Approved memory is stored under the durable visitor identity.
6. When the same visitor returns later, the app resolves that visitor identity before starting a new Tavus conversation.
7. The app injects safe remembered context into Tavus `conversational_context`.

Each Tavus session is still a new conversation. Memory continuity comes from app-owned visitor identity plus approved Hermes memory, not from reusing an old Tavus room.

## Current Normal Website Start Flow

The customer-facing Dani entry points are:

- `components/home/HeroBillboard.tsx`
- `components/AgentDemoButton.tsx`
- `components/TavusPlayer.tsx`

`TavusPlayer` starts Dani with:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

The public button sends no request body and no `memory_context`. T24 intentionally preserved that UI behavior.

The server route is:

- `app/api/conversation/start/route.ts`

It creates a fresh app-owned identity through:

- `lib/xagent/sessionIdentity.mjs`

Current fields created on start:

- `tenant_id=ai-fusion-labs`
- `agent_slug=dani`
- `visitor_id=visitor_<uuid>`
- `session_id=xagent_session_<uuid>`
- `provider=tavus`
- `provider_conversation_id` from Tavus `conversation_id`
- `startedAt`

Current limitation: `visitor_id` is random per start and is not tied to a durable returning-user identity. `TavusPlayer` stores the returned fields in `sessionIdentityRef`, but that ref is not persisted and is not posted back on session close.

## Current Memory Injection State

The route has two memory paths:

1. Supplied-body harness path:
   - `lib/xagent/conversationStartMemoryContext.mjs`
   - accepts `memory_context` only when memory gates are open

2. T24 normal-site fixture path:
   - `lib/xagent/serverSideMemoryContextResolver.mjs`
   - when all normal-site gates are open and no body is supplied, loads `tests/fixtures/hermes-next-session-context-preview-dani.json`

The T24 path proves that a normal no-body POST can attach `conversational_context` server-side, but it is still fixture/proof-store style. It does not yet resolve real returning-user memory.

The Tavus request body is built by:

- `lib/tavus.ts`
- `lib/tavusCreateConversationBody.mjs`

It uses:

- `persona_id`
- `replica_id`
- unchanged `custom_greeting`
- `properties`
- optional `callback_url`
- optional `conversational_context`

Memory is not placed in `custom_greeting`. Tavus `memory_stores` is not used in this lane.

## Current Transcript Lifecycle

Transcript retrieval exists as proof/helper code:

- `lib/tavusTranscript.mjs`
- `lib/xagent/sessionCompletedFromTavus.mjs`
- `app/api/xagent/session-completed/from-tavus/dry-run/route.ts`
- `scripts/manual-tavus-transcript-dry-run.mjs`
- `tests/tavus-transcript-fetch.test.mjs`

`lib/tavusTranscript.mjs` supports Tavus verbose retrieval:

```text
GET https://tavusapi.com/v2/conversations/{conversation_id}?verbose=true
```

It reads `application.transcription_ready`, extracts `properties.transcript`, maps Tavus `user` to Hermes `user`, maps Tavus `assistant` to Hermes `agent`, drops `system` and `tool` turns from memory input, and rejects unknown roles. It also returns source/retained/dropped turn metadata.

Current limitations:

- No normal website path automatically retrieves transcripts after a session.
- No production transcript store exists.
- No production memory write exists.
- No post-session completion trigger exists from `TavusPlayer` close.
- The existing dry-run paths require supplied identity fields and transcript data or a controlled Tavus transcript read.

Conversation `caff3b09bd8e7459` could be used later as a separately approved read-only transcript proof candidate because a Tavus conversation id is enough input for the verbose helper. T26 did not call Tavus.

## Existing Outbound And Admin Surfaces

The repo has existing non-Hermes backend tooling:

- `app/api/beta-signup/route.ts`
- `components/home/BetaSignupSection.tsx`
- `app/api/persona/patch/route.ts`
- `components/admin/TavusTuningPanel.tsx`

`/api/beta-signup` uses Resend to send a beta signup/admin notification email. That is a marketing lead form path, not a Tavus session-completion memory path.

`/api/persona/patch` can patch Tavus persona tuning values. That is an admin tuning adapter, not a memory path.

Search result summary:

- No normal-session transcript evaluation pipeline exists.
- No Tavus session thank-you email pipeline exists.
- No Tavus session follow-up email pipeline exists.
- No Tavus session admin notification based on transcript analysis exists.
- No production CRM/write/outbound workflow exists for Hermes memory.

Future Hermes work should not silently inherit Resend behavior. Any outbound email, admin notice, CRM update, or follow-up action must remain gated, proofed, and operator-approved.

## Intended End-State Flow

### First Visit

1. Visitor starts Dani from the normal website.
2. Server creates or resolves:
   - `tenant_id`
   - `agent_slug=dani`
   - durable `visitor_id`
   - new `session_id`
   - `provider=tavus`
3. Server starts a new Tavus conversation.
4. Server records the `provider_conversation_id` as session provenance.
5. App optionally shows or saves a user-friendly return code for the visitor.
6. After the session ends, the app retrieves the Tavus transcript by `provider_conversation_id`.
7. App builds `xagent.session.completed`.
8. Hermes processes the transcript into a summary candidate.
9. Operator/policy review approves or rejects the memory candidate.
10. Approved memory is stored under the durable visitor identity.

### Return Visit

1. Visitor provides a return code, email, or other approved identifier.
2. App resolves that identifier to a durable `visitor_id`.
3. App retrieves approved memory for `visitor_memory_namespace`.
4. App creates a new `session_id` and a new Tavus conversation.
5. App converts recalled memory into safe Dani continuity context.
6. App attaches that context to Tavus `conversational_context`.
7. Dani may naturally continue from relevant prior goals and preferences.
8. Dani must not claim hidden persistence, emails, CRM updates, purchases, or other external actions.

## Recommended Identity Strategy For Now

Use an app-owned durable visitor identity with an optional return code.

Recommended near-term shape:

- `tenant_id`: `ai-fusion-labs`
- `agent_slug`: `dani`
- `visitor_id`: `visitor_<uuid>` or `visitor_<opaque_random_id>`
- `session_id`: `xagent_session_<uuid>`
- `return_code`: user-facing lookup token
- `return_code_hash`: stored lookup value, not the raw code in long-term storage

The return code should resolve a prior visitor, not a prior Tavus conversation. A returning visitor should always start a new Tavus conversation.

For the first implementation preview, use local fixture/proof-store records only. Do not add production database persistence yet.

## Suggested Return Code Format

Recommended display format:

```text
DANI-RET-XXXX-XXXX-XXXX
```

Rules:

- Use Crockford Base32 or another human-friendly uppercase alphabet.
- Avoid ambiguous characters such as `0`, `O`, `1`, `I`, and `L`.
- Generate at least 60 bits of randomness.
- Store only a salted hash in future persistent storage.
- Show the code as a convenience, not as an authentication factor for sensitive data.
- Allow email or account login to replace or supplement the return code later.

Example placeholder:

```text
DANI-RET-K7P4-M9Q2-T6VA
```

## Suggested Namespace Shape

Session memory namespace:

```text
xagents/{tenant_id}/{agent_slug}/{visitor_id}/{session_id}
```

Visitor memory namespace:

```text
xagents/{tenant_id}/{agent_slug}/{visitor_id}
```

Return-code lookup should map to `visitor_id`, then to `visitor_memory_namespace`. The return code itself should not be embedded in the namespace.

`provider_conversation_id` must remain provenance only. It should not become the primary namespace because a returning user will have many Tavus conversations over time.

## What Should Be Stored

Future storage should be split by purpose.

Visitor identity record:

- `tenant_id`
- `agent_slug`
- `visitor_id`
- `return_code_hash` if using return codes
- optional verified email mapping later
- `created_at`
- `last_seen_at`
- consent/retention metadata

Session record:

- `tenant_id`
- `agent_slug`
- `visitor_id`
- `session_id`
- `provider=tavus`
- `provider_conversation_id`
- `started_at`
- `completed_at` if known
- completion status

Memory candidate/store record:

- `memory_record_id`
- `visitor_memory_namespace`
- `memory_namespace`
- safe summary text
- confidence
- summary hash
- source transcript hash
- redacted transcript hash if applicable
- provenance ids
- retention policy
- redaction policy
- operator review status

## What Should Never Be Stored In The Start Response Or Prompt

Do not expose or store in public route responses:

- raw transcript text
- Tavus verbose payloads
- system/tool transcript turns
- prompt/context block text
- memory summary text unless the route is an internal preview route
- hashes
- namespaces
- backend IDs
- Tavus API key
- room URL in proof artifacts
- payment/auth/government identifiers
- outbound action claims

Do not send to Tavus:

- `memory_stores` for this Hermes-owned memory lane
- memory content in `custom_greeting`
- backend hashes, namespaces, or proof IDs
- unreviewed outbound/action claims

## Hermes Ownership

Hermes should eventually own or orchestrate:

- transcript interpretation
- transcript minimization and redaction policy
- summary generation
- operator review
- memory candidate creation
- memory promotion policy
- memory recall policy
- lead/follow-up/admin recommendations
- workflow decisioning
- outbound action gating

Hermes should not automatically send email, update CRM, write production memory, or claim external work happened without explicit gates and proof.

## Website Adapter Ownership

`x-agent-website-t` should remain the Tavus-specific product adapter:

- render the normal customer-facing Dani start flow
- create and return app-owned session identity
- resolve durable visitor identity
- construct Tavus `createConversation` requests
- attach safe `conversational_context`
- retrieve Tavus transcripts through a bounded adapter
- create app-owned `xagent.session.completed` payloads
- hand off to Hermes through a disabled/local or approved backend adapter

Existing Resend beta signup code should remain a separate marketing lead adapter unless Hermes is explicitly approved to prepare or trigger an outbound recommendation.

## Current Gap To Real Returning-User Memory

Current implementation proves:

- app-owned session identity can be returned
- transcript retrieval can be mocked and manually proven
- `xagent.session.completed` payloads can be built
- disabled job-file handoff can be written under gates
- recalled memory can be shaped into safe prompt context
- Tavus `conversational_context` can be attached
- T24 can attach fixture memory on a normal no-body start when gates are open

Still missing for the real product:

- durable visitor identity
- return-code or email lookup
- session identity persistence long enough for post-session completion
- automatic post-session transcript retrieval trigger
- approved memory store adapter
- production-safe recall lookup
- customer-facing return code capture UI
- operator-reviewed outbound recommendation path

## Smallest Safe T27 Slice

Recommended T27:

Add a disabled-by-default return-code capture/lookup preview.

Scope:

- local fixture/proof-store only
- no production database
- no live Tavus
- no Hermes dispatch
- no OpenAI/Codex
- no Ollama
- no Resend/email
- no outbound workflow
- no customer-facing UI change yet

Suggested helper:

```text
lib/xagent/returningVisitorIdentityPreview.mjs
```

Suggested route:

```text
POST /api/xagent/returning-visitor/lookup-preview
```

Suggested gates:

```text
XAGENT_RETURN_CODE_LOOKUP_PREVIEW_ENABLED=true
XAGENT_DANI_RETURN_CODE_LOOKUP_PILOT_ENABLED=true
XAGENT_RETURN_CODE_LOOKUP_KILL_SWITCH=false
```

T27 should prove:

- closed gates refuse safely
- a sample return code resolves to a durable `visitor_id`
- the same `visitor_id` maps to the expected `visitor_memory_namespace`
- a new `session_id` is created for the next session
- no Tavus conversation is created
- no memory is injected into Tavus yet
- no raw transcript, prompt, hash, namespace, backend id, API key, email, or outbound claim leaks in the public response

After T27, a later phase can connect the return-code preview to the existing T24 server-side memory resolver, still behind gates and still without changing the public button UI until explicitly approved.
