# Hermes Return-Code Live Conversation Start T31 Proof

Phase T31 proves that a returning-user code can start a brand-new Dani Tavus conversation through the hosted `/api/conversation/start` route with server-side memory attached.

## Scope

This was a controlled hosted route proof only. It did not change the customer-facing UI, join a Tavus room, call Hermes, call OpenAI/Codex, call Ollama, send Resend/email, mutate production database state, persist production memory, add a webhook, use Tavus `memory_stores`, or put memory into `custom_greeting`.

The only approved live action was one POST to:

```text
https://x-agent-website-t.vercel.app/api/conversation/start
```

The request supplied the approved local Dani return-code fixture value. The actual return code value was not stored.

## Pre-Live Checks

Production was confirmed to be deployed from commit `f726eb0`, which is the current T29/T30 proof commit and later than the required T29 implementation commit.

The deployed Vercel build output included:

```text
/api/conversation/start
/api/xagent/return-code-conversation-start/dry-run
```

All nine required production gates were confirmed present and matching the required `true/true/false` patterns. Gate values were checked through a temporary local env pull outside the repo and were not stored in proof artifacts.

Local validation passed before the live start:

```powershell
npm run test:hermes-return-code-conversation-start-hosted-t30-proof
npm run test:hermes-return-code-normal-start-integration-t28
npm run lint
npx tsc --noEmit
```

## Live Start Result

Exactly one hosted return-code start POST was attempted.

Safe captured result:

- `http_status=200`
- `conversation_url_present=true`
- `provider_conversation_id=cef91e8a6b1d9476`
- `tenant_id=ai-fusion-labs`
- `agent_slug=dani`
- `provider=tavus`
- `return_code_supplied=true`
- `return_code_valid=true`
- `server_side_memory_lookup_attempted=true`
- `server_side_memory_context_applied=true`
- `tavus_conversational_context_attached=true`
- `tavus_room_joined=false`
- `customer_button_changed=false`
- `memory_stores_used=false`
- `custom_greeting_memory_injection=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `production_memory_persistence_used=false`
- `outbound_action_taken=false`

## Safety

The proof artifact does not store:

- the actual return code value
- actual room URL
- prompt/context text
- memory summary
- hashes
- namespaces
- backend IDs beyond the explicitly approved route/session identity fields
- transcript/content/messages
- API keys

## Next Decision

The next phase can be manual behavior evaluation or a private operator/test UI, only after explicit approval.
