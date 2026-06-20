# Hermes Return-Code Preview UI Hosted T34 Proof

Phase T34 verifies the private return-code preview UI on hosted production.

## Scope

This was a hosted private UI proof only. It did not create a Tavus conversation, did not POST to `/api/conversation/start`, did not join a Tavus room, did not call Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflows, production database, or production memory, did not add/register a webhook, and did not change the public `TavusPlayer` button flow.

## Deployment And Gates

Production was confirmed deployed from T33 commit `53058f3`.

The Vercel build output showed:

```text
/admin/hermes-return-code-preview
```

as a dynamic route.

The private UI gate was confirmed open:

```text
XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED=true
```

The nine return-code and memory gates were also confirmed open. Gate values were checked through a temporary local env pull outside the repo and were not stored in proof artifacts.

## Hosted UI Check

Hosted page:

```text
https://x-agent-website-t.vercel.app/admin/hermes-return-code-preview
```

Safe client check:

1. Fetched the hosted admin preview page.
2. Confirmed the enabled state was visible.
3. Used the approved local fixture return code without storing the value.
4. Posted exactly once to the dry-run route:

```text
https://x-agent-website-t.vercel.app/api/xagent/return-code-conversation-start/dry-run
```

No request was made to `/api/conversation/start`.

## Safe Captured Result

- `hosted_page_http_status=200`
- `hosted_page_reachable=true`
- `enabled_state_visible=true`
- `disabled_state_visible=false`
- `dry_run_http_status=200`
- `return_code_supplied=true`
- `return_code_valid=true`
- `memory_context_requested=true`
- `server_side_memory_lookup_attempted=true`
- `server_side_memory_context_applied=true`
- `tavus_conversational_context_attached=true`
- `tavus_create_conversation_called=false`
- `posted_to_conversation_start=false`
- `live_tavus_called=false`
- `live_hermes_called=false`
- `openai_called=false`
- `ollama_generate_called=false`
- `resend_called=false`
- `production_database_mutated=false`
- `production_memory_persistence_used=false`
- `outbound_action_taken=false`

## Redaction

The proof does not store:

- actual return-code value
- prompt/context text
- memory summary
- transcript/content/messages
- hashes
- namespaces
- backend IDs
- API keys
- room URL

## Next Decision

The next phase can be a controlled private live-start operator UI or real memory-store design.
