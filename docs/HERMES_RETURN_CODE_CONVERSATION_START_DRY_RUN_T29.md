# Hermes Return-Code Conversation Start Dry-Run T29

Phase T29 adds a hosted-safe dry-run route for the return-code conversation-start path.

The regular `/api/conversation/start` route cannot be used for a hosted dry-run because successful execution creates a Tavus conversation. T29 therefore adds an internal dry-run route that exercises the same T28 return-code resolver logic but never calls Tavus.

## Route

```text
POST /api/xagent/return-code-conversation-start/dry-run
```

Accepted body:

```json
{
  "return_code": "DANI-RET-K7P4-M9Q2-T6VA"
}
```

`returnCode` is accepted as an equivalent camelCase field.

## Required Gates

The route requires the Tavus memory injection gates:

```text
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true
XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false
```

It also requires the return-code lookup gates:

```text
XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH=false
```

With gates closed, the route rejects safely and does not resolve memory.

## Safe Response

Successful response fields are summary-only:

- `return_code_supplied=true`
- `return_code_valid=true`
- `agent_slug=dani`
- `tenant_id=ai-fusion-labs`
- `memory_context_requested=true`
- `memory_context_applied=false`
- `server_side_memory_lookup_attempted=true`
- `server_side_memory_context_applied=true`
- `tavus_conversational_context_attached=true`
- `tavus_create_conversation_called=false`
- `live_tavus_called=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `production_memory_database_mutated=false`
- `outbound_action_taken=false`

The route never returns:

- prompt text
- memory summary text
- transcript/content/messages
- hashes
- namespaces
- backend ids
- API keys
- room URL

## Safety

This phase does not:

- create a Tavus conversation
- join a Tavus room
- call Tavus
- call Hermes
- call OpenAI/Codex
- call Ollama
- send Resend/email
- write production database or production memory
- add/register a webhook
- use Tavus `memory_stores`
- put memory into `custom_greeting`
- change the customer-facing button UI

## Validation

```powershell
npm run test:hermes-return-code-conversation-start-dry-run-t29
```

The test proves:

- gates closed fail safely
- valid return code resolves safe memory context summary flags
- invalid return code fails before any Tavus call
- `TavusPlayer` remains unchanged
- route source does not import Tavus createConversation or Resend
- no sensitive memory internals leak from the response

## Hosted Proof Plan

After local validation, commit and push T27/T28/T29 code, wait for Vercel production to deploy the commit, then perform exactly one hosted POST to this dry-run route.

Do not POST to `/api/conversation/start` in this phase.
