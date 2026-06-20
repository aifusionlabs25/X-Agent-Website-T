# Hermes Normal Public Session Memory Diagnostic T32

Phase T32 diagnoses why the normal public website session `c683efa0a485a43f` should not be treated as a failure of the controlled return-code memory path.

No Tavus conversation was created, no `/api/conversation/start` POST was made, no Tavus room was joined, no Tavus GET was needed, no raw transcript or room URL was stored, and no Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory behavior was invoked.

## Session Under Review

- `provider_conversation_id=c683efa0a485a43f`
- `normal_public_site_session=true`
- User report: Dani did not remember prior conversations.

This was a normal public website session, not the controlled T31 return-code session.

## Public Start Flow

`components/TavusPlayer.tsx` still starts Dani with:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

That request sends:

- no JSON body
- no `return_code`
- no email identity
- no account identity
- no supplied `memory_context`

The component receives the returned `conversation_url` and immediately joins the room through Daily. It stores route-returned session identity in a local React ref, but that ref is not persisted as a durable returning-user identity and is not currently used for future recall.

## Public Identity Capture

There is currently no public UI that asks the returning visitor for:

- a return code
- an email for memory lookup
- an account login
- another durable visitor identifier

The existing beta signup email path is a marketing/admin notification path, not a returning-session memory identity path. It should not be conflated with Hermes memory recall.

## Route Behavior

`app/api/conversation/start/route.ts` can attach Tavus `conversational_context` when memory context is resolved. Today there are three distinct paths:

1. Supplied `memory_context` harness path.
2. Normal no-body server-side local fixture path, gated and proof-only.
3. Return-code lookup path, gated and requiring `return_code` or `returnCode` in the request body.

The normal public button uses none of the identity-bearing request fields. Therefore the route cannot know which prior visitor memory should be retrieved for the human who started `c683efa0a485a43f`.

## Comparison To Prior Proofs

### T25: Normal No-Body Fixture Path

T25 proved the hosted normal no-body route can attach a local fixture context when the server-side fixture gates are open. That is not the same thing as durable user-specific memory. It does not prove that the public website can identify a returning visitor or retrieve that visitor's real prior session memory.

### T30: Hosted Return-Code Dry-Run

T30 proved the hosted return-code dry-run route can resolve Dani memory safely with all gates open, without creating a Tavus conversation.

### T31: Controlled Return-Code Live Start

T31 proved a controlled hosted `/api/conversation/start` request with a valid return-code body can create a new Tavus conversation with server-side memory attached. This remains valid, but it was not the same flow as the normal public website button.

### c683: Normal Public Website Session

`c683efa0a485a43f` came from the normal public website session path. That path did not submit a return code, email, account, or other durable visitor identity. A user-specific remembered-context result should not be expected from that path yet.

## Diagnostic Conclusion

`c683efa0a485a43f` should not be expected to remember prior user-specific conversations yet.

Root cause:

```text
missing_returning_user_identity_and_real_memory_store
```

More specifically:

- public UI does not collect or submit a return code
- public UI does not collect or submit a memory lookup email or account identity
- route-created `visitor_id` is random per start and is not yet a returning-user key
- real prior sessions are not yet processed into durable production memory
- no production memory store lookup exists for normal returning users
- the current return-code proof uses local fixture/proof-store memory only

## Missing Product Pieces

The real product memory loop still needs:

1. Return-code, email, or account identity capture.
2. Durable visitor/user identity resolution.
3. Post-session transcript retrieval for real completed sessions.
4. Hermes transcript interpretation into a memory candidate.
5. Operator review or policy approval.
6. Durable memory-store promotion.
7. Returning-user memory retrieval before a new Tavus start.
8. Safe injection into Tavus `conversational_context`.

## Recommended Next Step

The smallest next product implementation slice is a private return-code or email capture UI preview:

- no public rollout yet
- no production database yet
- no Hermes dispatch yet
- no email/outbound behavior
- use local fixture/proof-store lookup first
- submit the return code to `/api/conversation/start` only in a private/operator test surface
- preserve the existing public button behavior until the identity and memory-store design is approved

This is the right next step before further room URL testing or broad public UI rollout.
