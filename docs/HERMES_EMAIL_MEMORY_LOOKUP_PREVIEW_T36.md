# Hermes Email Memory Lookup Preview T36

Phase T36 adds a disabled-by-default email identity memory lookup dry-run and private preview path for Dani.

This phase stays inside `x-agent-website-t`. It does not edit `tavus-xlink-hub`, touch X-LINK / Anam.ai hub, create a Tavus conversation, call live Tavus, call Hermes, call OpenAI/Codex, call Ollama, call Resend/email, send outbound workflow actions, mutate production database state, mutate production memory, add a webhook, or change public customer-facing UI.

## Source Alignment

T36 follows the local Phase T35 email identity memory contract and the read-only `tavus-xlink-hub` H-email-2 fixture proof shape.

The fixture lane is intentionally local and non-production. It proves that the website can:

- accept a pre-session email input
- trim and lowercase it
- validate a basic email shape
- derive a deterministic email identity hash internally
- map that identity to a local Dani memory context fixture
- return only safe lookup flags

Safe responses do not include raw email, normalized email, email hash, namespaces, prompt text, memory summary, transcript fields, backend IDs, room URLs, API keys, or fixture salts.

## Gates

Email lookup dry-run gates:

```text
XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED=true
XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED=true
XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH=false
```

Private preview UI gate:

```text
XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED=true
```

All gates are closed by default. With gates closed, the dry-run route returns a safe rejection and the private page shows a disabled state.

## Files

- Helper: `lib/xagent/emailIdentityMemoryLookup.mjs`
- UI gate helper: `lib/xagent/emailMemoryPreviewUi.mjs`
- Dry-run route: `app/api/xagent/email-memory-lookup/dry-run/route.ts`
- Private preview page: `app/admin/hermes-email-memory-preview/page.tsx`
- Private preview client: `app/admin/hermes-email-memory-preview/EmailMemoryPreviewClient.tsx`
- Local fixture: `tests/fixtures/hermes-email-memory-lookup-dani.json`
- Tests:
  - `tests/hermes-email-memory-lookup-t36.test.mjs`
  - `tests/hermes-email-memory-preview-ui-t36.test.mjs`

## Dry-Run Route

```text
POST /api/xagent/email-memory-lookup/dry-run
```

Accepted request field:

```json
{
  "email": "supplied before start"
}
```

The route never calls Tavus, never calls Hermes, never sends email, and never writes production DB or production memory.

Safe response fields include:

```text
email_supplied
email_valid
email_identity_hash_derived
agent_slug
tenant_id
memory_context_preview_available
server_side_memory_context_applied=false
tavus_create_conversation_called=false
production_database_mutated=false
live_tavus_called=false
live_hermes_called=false
outbound_action_taken=false
```

Unsafe fields are intentionally excluded:

```text
raw email
normalized email
email hash
fixture salt
visitor namespace
memory namespace
prompt text
memory summary
transcript/content/messages
backend IDs
API keys
room URLs
```

## Private Preview UI

The private page is:

```text
/admin/hermes-email-memory-preview
```

It is an operator-only preview surface. It lets an operator enter an email, validates basic shape locally, calls only the email lookup dry-run route, clears the email input after submit, and displays only safe booleans.

The page never calls `/api/conversation/start`, never creates a Tavus conversation, and never displays raw email after submit.

## Relationship To Future Start Flow

T36 does not wire email lookup into `/api/conversation/start`. The next phase can connect this helper to the normal start resolver behind closed-by-default gates, still without public UI rollout.

The future start flow should:

- accept email before starting Dani
- derive the identity server-side
- lookup only approved memory
- inject only safe remembered context through Tavus `conversational_context`
- keep memory out of `custom_greeting`
- avoid Tavus `memory_stores` for this Hermes-owned lane
- keep raw email out of Tavus prompts and public responses

## Validation

```powershell
npm run test:hermes-email-identity-memory-contract-t35
npm run test:hermes-email-memory-lookup-t36
npm run test:hermes-email-memory-preview-ui-t36
npm run lint
npx tsc --noEmit
npm run build
```
