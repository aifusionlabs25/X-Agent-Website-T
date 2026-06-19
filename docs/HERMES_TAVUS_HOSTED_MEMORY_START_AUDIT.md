# Hermes Tavus Hosted Memory Start Audit

Phase T19 audits why hosted Dani conversations still show empty Tavus `conversational_context` after memory gates were added and deployed.

## Baseline

- Hosted conversation ID: `c678ef85f062348b`
- Real transcript exists.
- Tavus `conversational_context` was present but empty.
- Tavus `memory_stores` was absent.

## Finding

The normal hosted website button does not send memory context to `/api/conversation/start`.

Source path:

1. `components/home/HeroBillboard.tsx` renders `<TavusPlayer onClose={() => setIsPlaying(false)} />` for the homepage Start Conversation button.
2. `components/AgentDemoButton.tsx` renders the same `TavusPlayer` for Dani’s agent-card live demo button.
3. `components/TavusPlayer.tsx` starts the session with:

```ts
fetch('/api/conversation/start', { method: 'POST' })
```

That request has no JSON body and no `memory_context`. When the hosted route gates are open, `/api/conversation/start` can apply memory only when a valid `memory_context` body is supplied. With the normal button flow, the route has no memory input and correctly falls back to no-memory behavior.

## What Was Not Changed

- The normal customer-facing button was not changed.
- No live hosted POST was made in T19.
- No Tavus conversation was created.
- No Tavus room was joined.
- No Tavus `memory_stores` path was added.
- No memory was placed in `custom_greeting`.
- No webhook was added or registered.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production DB, or production memory behavior was added.

## Hosted Memory-Enabled Test Harness

T19 adds a safe manual harness:

```powershell
$env:XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST="true"
$env:XAGENT_HOSTED_TAVUS_MEMORY_START_URL="https://<deployed-site>/api/conversation/start"
$env:XAGENT_HOSTED_TAVUS_MEMORY_START_OUTPUT_PATH="docs/proofs/hermes_tavus_hosted_memory_start_safe_capture.json"
npm run hermes:manual-hosted-tavus-memory-start
```

The harness refuses unless:

- `XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST=true`
- `XAGENT_HOSTED_TAVUS_MEMORY_START_URL` is an HTTPS URL whose path is `/api/conversation/start`

The harness posts:

```json
{
  "memory_context": "<tests/fixtures/hermes-next-session-context-preview-dani.json>"
}
```

It prints and optionally stores only safe response fields:

- `http_status`
- `conversation_url_present`
- `provider_conversation_id`
- `tenant_id`
- `agent_slug`
- `visitor_id`
- `session_id`
- `provider`
- `memory_context_requested`
- `memory_context_applied`
- `tavus_conversational_context_attached`

It must not print or store actual room URL, recalled memory summary, prompt text, `conversational_context`, hashes, namespaces, backend IDs, transcript/content/messages, or API key.

## Next Decision

Approve exactly one hosted memory POST using the new harness, then optionally approve a real Dani conversation join to evaluate remembered-context behavior.
