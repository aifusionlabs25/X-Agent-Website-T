# Hermes Email Memory Lookup Hosted Dry Run T38

Phase T38 verifies the deployed production email memory lookup dry-run route for Dani.

This phase stayed inside `x-agent-website-t`. It did not edit `tavus-xlink-hub`, touch X-LINK / Anam.ai hub, post to `/api/conversation/start`, create a Tavus conversation, join a Tavus room, call live Tavus createConversation, call Hermes, call OpenAI/Codex, call Ollama, call Resend/email, send outbound workflow actions, mutate production database state, mutate production memory, add a webhook, or change public customer-facing UI.

## Deployment

GitHub `main` was already at the email identity memory lookup commit:

```text
b09b827 Add email identity memory lookup for Dani
```

Vercel production was redeployed from that commit. The deployment build output listed:

```text
/api/xagent/email-memory-lookup/dry-run
```

## Gate Check

Production gate names were confirmed present and set to the required states before the hosted dry-run POST.

Required memory and normal-site gates:

```text
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED
XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED
XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED
XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED
XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH
```

Required email lookup gates:

```text
XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED
XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED
XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH
```

Gate values were checked through a temporary local env pull and were not stored in repo proof artifacts.

## Hosted Dry-Run POST

Exactly one hosted POST was made to:

```text
https://x-agent-website-t.vercel.app/api/xagent/email-memory-lookup/dry-run
```

The request used the approved local fixture/test email input. The raw email value, normalized email value, email hash, fixture salt, namespaces, prompt text, memory summary, transcript/content/messages, backend IDs, room URL, and API keys were not stored.

Safe capture:

```text
http_status=200
email_supplied=true
email_valid=true
email_identity_hash_derived=true
memory_context_preview_available=true
server_side_memory_context_applied=false
tavus_create_conversation_called=false
live_tavus_called=false
live_hermes_called=false
openai_called=false
ollama_generate_called=false
resend_called=false
production_database_mutated=false
production_memory_persistence_used=false
outbound_action_taken=false
```

## Boundary Result

The hosted route resolved the local fixture-backed email identity lookup in dry-run mode. It did not create a Tavus conversation and did not exercise the normal conversation start route.

The next phase can be a controlled live start with email, only after explicit approval.
