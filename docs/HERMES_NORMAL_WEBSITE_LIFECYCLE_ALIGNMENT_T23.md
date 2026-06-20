# Hermes Normal Website Lifecycle Alignment T23

Phase T23 audits the real customer-facing Dani website lifecycle against the Hermes memory and worker path proven in the T-phase work. This is a read-only lifecycle alignment audit. No Tavus conversation was created, no Tavus room was joined, no transcript was fetched, no email was sent, and no production data was mutated.

## Scope And Baseline

- Normal live customer conversation under review: `caff3b09bd8e7459`
- T21 harness-created memory conversation, used only as proof context: `c1fd221a0eaa74c0`
- Normal website entry points:
  - `components/home/HeroBillboard.tsx`
  - `components/AgentDemoButton.tsx`
  - `components/TavusPlayer.tsx`
- Normal server start route:
  - `app/api/conversation/start/route.ts`
- Tavus create-conversation adapter:
  - `lib/tavus.ts`
  - `lib/tavusCreateConversationBody.mjs`

Conversation `caff3b09bd8e7459` can be used later as a read-only transcript proof candidate because Tavus conversation ids are sufficient input for the existing verbose Get Conversation helper. It was not queried during T23.

## Normal Public Website Start Flow

The public homepage button in `components/home/HeroBillboard.tsx` opens `TavusPlayer` when the user clicks Start Conversation. Dani agent cards use the same `TavusPlayer` through `components/AgentDemoButton.tsx`.

`components/TavusPlayer.tsx` starts the backend flow with:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

That normal customer request sends no JSON body and no `memory_context`. The component receives the returned `conversation_url`, creates a Daily iframe, and immediately joins the Tavus room. It also stores the returned app-owned session fields in `sessionIdentityRef`, but that ref is not currently sent back to the backend on close and is not persisted server-side.

## Conversation Start Route

`app/api/conversation/start/route.ts` now creates Dani app-owned identity on each start:

- `tenant_id`
- `agent_slug=dani`
- `visitor_id`
- `session_id`
- `provider=tavus`
- `provider_conversation_id`
- `startedAt`

The route has optional memory injection code behind:

- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true`
- `XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true`
- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false`

When those gates are open, the route attempts to parse request JSON and validates supplied `memory_context`. If valid, it passes `conversationalContext` into `createConversation`. If invalid, it fails safely before Tavus. If the normal website request sends no body, the route falls back to no-memory behavior.

Direct answer: the normal website button does not currently send `memory_context`.

Direct answer: the normal route does not auto-fetch memory server-side before `createConversation`. It only applies memory supplied in the request body.

## Tavus Create Conversation Body

`lib/tavus.ts` calls Tavus:

```ts
POST https://tavusapi.com/v2/conversations
```

`lib/tavusCreateConversationBody.mjs` builds the body with:

- `persona_id`
- `replica_id`
- unchanged `custom_greeting`
- `properties.max_call_duration`
- `properties.participant_absent_timeout`
- `properties.participant_left_timeout`
- optional `callback_url`
- optional `conversational_context`

Memory is not placed in `custom_greeting`. Tavus `memory_stores` is not used in this lane.

One implementation caveat: the route still computes `callback_url` as `/api/webhook`, but no `app/api/webhook` route exists in this repo. The proven Hermes lane does not rely on Tavus webhooks; it uses post-session transcript retrieval.

## Transcript Lifecycle

Current transcript retrieval exists only in proof/helper paths:

- `lib/tavusTranscript.mjs`
- `lib/xagent/sessionCompletedFromTavus.mjs`
- `app/api/xagent/session-completed/from-tavus/dry-run/route.ts`
- `scripts/manual-tavus-transcript-dry-run.mjs`
- `tests/tavus-transcript-fetch.test.mjs`

`lib/tavusTranscript.mjs` implements a mockable Tavus verbose read:

```text
GET https://tavusapi.com/v2/conversations/{conversation_id}?verbose=true
```

It looks for `application.transcription_ready`, reads `properties.transcript`, maps Tavus `user` to Hermes `user`, maps Tavus `assistant` to Hermes `agent`, drops `system` and `tool` turns from memory input, and rejects unknown roles. It returns retained user/agent turns plus metadata about source turn count and dropped non-memory roles.

Current transcript storage and processing:

- There is no production transcript persistence in the normal website flow.
- There is no automatic transcript retrieval when the user leaves the room.
- There is no production memory write.
- The proof routes return dry-run previews.
- The proof docs and fixtures store summary/redacted evidence only, not raw Tavus transcript content.

For `caff3b09bd8e7459`, the next safe transcript step would be a separately approved single Tavus GET/read using the existing verbose helper. Because the normal start identity is not persisted server-side, that later proof would need either the originally returned app session identity or an explicitly labeled manual/proof identity.

## Existing Backend Tools And Outbound Surfaces

The current repo has a few non-Hermes backend tools:

- `app/api/beta-signup/route.ts` uses Resend to send a beta sign-up/admin notification email to `aifusionlabs@gmail.com`.
- `components/home/BetaSignupSection.tsx` posts lead form data to `/api/beta-signup`.
- `app/api/persona/patch/route.ts` patches Tavus persona tuning values.
- `components/admin/TavusTuningPanel.tsx` calls `/api/persona/patch`.

Search findings:

- There is no normal-session transcript evaluation pipeline.
- There is no automated follow-up email pipeline tied to Tavus session completion.
- There is no thank-you email pipeline tied to Tavus session completion.
- There is no post-session admin notification tied to Tavus transcript analysis.
- Resend exists for the beta sign-up form, not the Hermes memory flow.

Hermes should eventually own or orchestrate memory summarization, operator review, memory-candidate promotion, future recall, and any future outbound intent review. Existing website code should remain the Tavus/website adapter layer: create conversation, preserve app identity, retrieve transcript, and hand off a bounded post-session job.

## Existing Hermes T-Phase Pieces

Implemented as proof or gated adapter pieces:

- Session identity: `lib/xagent/sessionIdentity.mjs`
- Session-completed dry-run payload: `lib/xagent/sessionCompletedPayload.mjs`
- Tavus verbose transcript helper: `lib/tavusTranscript.mjs`
- Tavus transcript to session-completed dry-run composer: `lib/xagent/sessionCompletedFromTavus.mjs`
- Disabled local Hermes job-file handoff skeleton: `lib/xagent/hermesDispatchHandoff.mjs`
- Session-start memory context preview: `lib/xagent/sessionMemoryContext.mjs`
- Tavus memory prompt preview: `lib/xagent/tavusMemoryPromptPreview.mjs`
- Tavus conversation-start payload preview: `lib/xagent/tavusConversationStartMemoryPreview.mjs`
- Real route memory injection, supplied-body only: `lib/xagent/conversationStartMemoryContext.mjs` and `app/api/conversation/start/route.ts`
- Runtime readiness: `lib/xagent/runtimeReadiness.mjs`
- Hosted proof that the harness path can attach memory: `docs/HERMES_TAVUS_HOSTED_MEMORY_START_T21_PROOF.md`

Important distinction: T21 proved the hosted route can attach memory when a special harness posts `memory_context`. It did not prove the normal website button performs memory recall or injection.

## Lifecycle Gap

The real product expectation is:

1. Returning visitor starts Dani from the normal website.
2. Website/backend identifies or creates stable visitor/session identity.
3. Backend retrieves safe recalled memory for that visitor.
4. Backend converts recalled memory into a safe Tavus `conversational_context`.
5. Tavus conversation starts with memory attached.
6. After session close, backend retrieves Tavus transcript by `provider_conversation_id`.
7. Backend builds `xagent.session.completed`.
8. Hermes summarizes, reviews, and stages memory according to gates.
9. Future sessions recall approved memory.

Current normal flow:

1. User starts Dani from the normal website.
2. `TavusPlayer` POSTs no body.
3. Backend creates transient app-owned identity.
4. Backend does not recall memory.
5. Tavus conversation starts without memory unless a special caller supplied `memory_context`.
6. Client joins the Tavus room.
7. On close, no backend completion event is triggered.
8. No transcript is automatically retrieved.
9. No Hermes handoff is automatically created.

## Smallest Next Implementation Slice

The next slice should make the normal website path use Hermes memory without changing the public button behavior:

1. Keep `TavusPlayer` calling `/api/conversation/start` with no request body.
2. Add a disabled-by-default server-side memory recall adapter inside `/api/conversation/start`.
3. Use a stable visitor identity source, such as an HTTP-only visitor cookie or a backend-generated visitor id returned and reused across sessions.
4. When gates are open, resolve a safe memory context server-side for that visitor.
5. Build the existing safe Dani prompt context and attach it as Tavus `conversational_context`.
6. Return only safe flags and session identity fields to the client.
7. Preserve no-memory behavior when gates are closed or no approved memory exists.

In parallel or immediately after, add a disabled post-session path:

1. Persist or otherwise retain the app-owned `tenant_id`, `agent_slug`, `visitor_id`, `session_id`, and `provider_conversation_id` long enough for completion.
2. Add a safe completion trigger that does not use webhooks by default.
3. Retrieve Tavus transcript with `GET /v2/conversations/{conversation_id}?verbose=true` only after approval/gates.
4. Build the existing `xagent.session.completed` payload.
5. Write the disabled local Hermes handoff job or keep dry-run preview only, depending on approval.

## Ownership Boundary

Website should own:

- Normal public UI and Tavus player lifecycle.
- App-owned session identity and visitor identity adapter.
- Tavus `createConversation` request construction.
- Safe `conversational_context` attachment.
- Tavus transcript retrieval adapter.
- Bounded handoff envelope to Hermes.

Hermes should own:

- Transcript minimization and summarization policy.
- Local/model execution and fallback rules.
- Operator review.
- Memory candidate creation.
- Memory persistence policy and adapter.
- Recall policy and next-session context shaping.
- Any future outbound intent review and action gating.

Existing Resend beta sign-up should remain a marketing lead form path unless separately redesigned. Hermes should not silently inherit outbound email behavior from that form.

## Recommendation

Do not continue evaluating the special T21 room as the product path. The product path is the normal website start. The next phase should implement a disabled-by-default normal-site server-side memory lookup/injection path, followed by a disabled post-session Hermes handoff path that retains session identity and retrieves the Tavus transcript after completion.
