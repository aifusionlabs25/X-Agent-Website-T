# Hermes Tavus Conversation Memory Injection

Phase T16 wires Dani memory context into the real Tavus conversation-start path behind disabled-by-default gates.

This phase uses Tavus `conversational_context` only when a valid Phase T12/T13 memory context payload is supplied and all injection gates are open. The default live start behavior remains no-memory.

## Gates

All gates are closed by default:

- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true`
- `XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED=true`
- `XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH=false`

When any gate is closed, `/api/conversation/start` does not parse or apply supplied memory context and calls Tavus with the existing no-memory request body.

## Tavus Field

The integration uses:

- `conversational_context`

It does not use:

- `custom_greeting` for memory
- `memory_stores`

`custom_greeting` remains the existing Dani greeting.

## Safety Rules

The supplied memory context is validated before Tavus fetch is called:

- `agent_slug=dani`
- `tenant_id=ai-fusion-labs`
- visitor namespace matches tenant/agent/visitor
- summary hash and record hash provenance are present and verified
- raw transcript, content, message, and turn fields are rejected
- outbound/action claims are rejected
- the generated prompt must not expose hashes, namespaces, memory IDs, or backend machinery

If gates are open and the supplied memory context is invalid, the route fails before calling Tavus.

## Response Boundary

The start response may include only safe booleans:

- `memory_context_requested`
- `memory_context_applied`
- `tavus_conversational_context_attached`

It must not return the memory summary, prompt text, hashes, namespaces, memory record IDs, or backend provenance.

## Testing

Use mocked fetch/body-building only:

- `npm run test:hermes-tavus-memory-injection`

Tests prove the request body shape without creating a live Tavus conversation. A future live Dani start with memory gates open requires separate explicit approval.
