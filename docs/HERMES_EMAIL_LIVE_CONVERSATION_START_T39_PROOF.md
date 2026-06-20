# Hermes Email Live Conversation Start T39 Proof

Phase T39 proves a controlled hosted `/api/conversation/start` request can start a brand-new Dani Tavus conversation with email identity memory attached server-side.

This phase stayed inside `x-agent-website-t`. It did not edit `tavus-xlink-hub`, touch X-LINK / Anam.ai hub, join a Tavus room, call Hermes, call OpenAI/Codex, call Ollama, call Resend/email, send outbound workflow actions, mutate production database state, mutate production memory, add/register a webhook, use Tavus `memory_stores`, put memory into `custom_greeting`, or change customer-facing UI.

## Preconditions

T38 proved the hosted email dry-run route succeeds with safe flags:

```text
email_valid=true
email_identity_hash_derived=true
memory_context_preview_available=true
tavus_create_conversation_called=false
```

Production was confirmed deployed from commit `b09b827` or later, and all nine required production memory/email gates were confirmed open before the live start. Gate values were checked through a temporary local env pull and were not stored in repo proof artifacts.

## Controlled Hosted Start

Exactly one hosted POST was made to:

```text
https://x-agent-website-t.vercel.app/api/conversation/start
```

The request supplied the approved local fixture/test email value. The raw email value, normalized email value, email hash, namespace values, prompt/context text, memory summary, transcript/content/messages, API keys, and actual Tavus room URL were not stored.

Safe capture:

```text
http_status=200
conversation_url_present=true
provider_conversation_id=c896274d7c2004bb
tenant_id=ai-fusion-labs
agent_slug=dani
provider=tavus
server_side_memory_lookup_attempted=true
server_side_memory_context_applied=true
tavus_conversational_context_attached=true
tavus_room_joined=false
memory_stores_used=false
custom_greeting_memory_injection=false
live_hermes_called=false
openai_called=false
ollama_generate_called=false
resend_called=false
production_database_mutated=false
production_memory_persistence_used=false
outbound_action_taken=false
```

## Result

A new Tavus conversation was created through the hosted route, and the app response showed that the server-side email identity memory lookup attached Tavus `conversational_context`.

The room was not joined. The next phase can be manual behavior evaluation or a private email-start operator UI, only after explicit approval.
