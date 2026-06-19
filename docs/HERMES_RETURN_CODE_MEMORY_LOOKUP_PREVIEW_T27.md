# Hermes Return-Code Memory Lookup Preview T27

Phase T27 adds a disabled-by-default local return-code memory lookup preview for Dani.

No live Tavus call is made. No Tavus conversation is created. No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory behavior is added or called.

## Product Purpose

Each Tavus session is new. Returning-user memory should be resolved by an app-owned durable visitor identity, such as a return code, email, or future account identity.

This phase implements only the return-code preview layer. It proves a user-facing return code can resolve to a local Dani memory context fixture without exposing backend memory internals.

## Files

- Helper: `lib/xagent/returnCodeMemoryLookup.mjs`
- Dry-run route: `app/api/xagent/return-code-memory-lookup/dry-run/route.ts`
- Local fixture: `tests/fixtures/hermes-return-code-memory-lookup-dani.json`
- Test: `tests/hermes-return-code-memory-lookup-t27.test.mjs`

## Gates

The preview is disabled by default. All gates must be exactly open:

```text
XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH=false
```

With gates closed, the route refuses safely and does not resolve memory.

## Return Code Format

The user-facing code shape is:

```text
DANI-RET-XXXX-XXXX-XXXX
```

The helper validates a human-friendly uppercase alphabet and normalizes lowercase or space-separated input into the canonical format. The local proof fixture uses:

```text
DANI-RET-K7P4-M9Q2-T6VA
```

The code resolves a visitor memory context. It does not expose or encode backend ids, hashes, namespaces, transcript text, or memory internals.

## Local Fixture Only

The lookup source is:

```text
tests/fixtures/hermes-return-code-memory-lookup-dani.json
```

That fixture points to the same Dani memory context shape proven in T12/T24. It is a local proof-store stand-in only. There is no production database lookup and no production persistence.

## Safe Route Response

The route is:

```text
POST /api/xagent/return-code-memory-lookup/dry-run
```

Safe response fields include:

- `dry_run_only=true`
- `return_code_lookup_preview_enabled`
- `return_code_valid`
- `agent_slug=dani`
- `tenant_id=ai-fusion-labs`
- `memory_context_preview_available`
- `memory_context_applied=false`
- `tavus_create_conversation_called=false`
- `live_tavus_called=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `production_memory_database_mutated=false`
- `outbound_action_taken=false`

The route does not return:

- prompt text
- memory summary text
- transcript/content/messages
- hashes
- namespaces
- backend ids
- API keys
- Tavus room URL

## Future T24 Integration

Internally, `resolveReturnCodeMemoryContext()` returns the memory context object that can later feed the existing T24 start-flow shaping:

```text
buildConversationStartMemoryContextForRequestBody({ memory_context })
```

The dry-run API intentionally does not expose that object. A later phase can wire this helper into the normal start flow behind gates, while still keeping the public button unchanged until explicitly approved.

## Next Phase

Recommended T28:

Wire return-code lookup into the normal `/api/conversation/start` memory resolver behind disabled-by-default gates, still without changing the customer-facing button UI and still without live Tavus, Hermes, model, email, outbound, or production DB behavior in tests.
