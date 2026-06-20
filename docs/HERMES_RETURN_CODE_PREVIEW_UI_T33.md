# Hermes Return-Code Preview UI T33

Phase T33 adds a private, disabled-by-default operator preview for the returning-user return-code UX.

## Route

```text
/admin/hermes-return-code-preview
```

The page is gated by:

```text
XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED=true
```

With the gate closed, the page renders a disabled state and makes no dry-run request.

## Behavior

When enabled, the page lets an operator enter a user-facing return code and run a local format check before making a dry-run request to:

```text
POST /api/xagent/return-code-conversation-start/dry-run
```

The UI never calls:

```text
/api/conversation/start
```

Therefore it does not create a Tavus conversation, join a Tavus room, or alter the public Dani start flow.

## Safe Status Fields

The UI displays only:

- `return_code_supplied`
- `return_code_valid`
- `memory_context_requested`
- `server_side_memory_lookup_attempted`
- `server_side_memory_context_applied`
- `tavus_conversational_context_attached`
- `tavus_create_conversation_called=false`

It does not display prompt text, memory summary, transcript/content/messages, hashes, namespaces, backend IDs, API keys, room URL, or the approved local fixture return code value.

## Public Flow

`components/TavusPlayer.tsx` remains unchanged and continues to call:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

No public button behavior changes in this phase.

## Next Decision

The next phase can be a hosted private UI proof or real memory-store design.
