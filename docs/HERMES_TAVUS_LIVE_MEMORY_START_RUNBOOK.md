# Hermes Tavus Live Memory Start Runbook

Phase T17.1 adds the safe capture harness for a future approved live Tavus create-conversation run. T17.1 does not execute the run.

## Current Proof Status

T17 made exactly one live `POST /api/conversation/start` request with Dani memory gates open. The local route logged HTTP `200`, so Tavus acceptance was inferred, but the PowerShell safe-field capture failed after the route completed. No retry was made and no conversation URL or provider conversation ID was captured.

Source proof:

- `docs/HERMES_TAVUS_LIVE_MEMORY_START_PROOF.md`
- `docs/proofs/hermes_tavus_live_memory_start_20260619T075555.json`

## Future Approved Run

Only run this after separate human approval for one live Tavus create-conversation attempt.

Start the local app in one terminal with the memory gates open:

```powershell
$env:XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED="true"
$env:XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED="true"
$env:XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH="false"
npm run dev
```

Then run the capture harness once:

```powershell
$env:XAGENT_ALLOW_LIVE_TAVUS_MEMORY_START_TEST="true"
$env:XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED="true"
$env:XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED="true"
$env:XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH="false"
$env:XAGENT_TAVUS_MEMORY_START_URL="http://127.0.0.1:3000/api/conversation/start"
$env:XAGENT_TAVUS_MEMORY_START_OUTPUT_PATH="docs/proofs/hermes_tavus_live_memory_start_next_safe_capture.json"
npm run hermes:manual-tavus-live-memory-start
```

The app process must have `TAVUS_API_KEY`, `TAVUS_PERSONA_ID`, and `TAVUS_REPLICA_ID` available. The harness also refuses to run unless those names are available in the harness process.

## Safe Capture Fields

The harness prints and optionally stores only:

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

## Explicit Exclusions

The harness must not print or store:

- recalled memory summary
- candidate prompt text
- `conversational_context`
- hashes
- namespaces
- backend proof IDs
- raw transcript, content, or messages
- Tavus API key
- Tavus room URL

## Boundaries

- This is a create-conversation capture only.
- Do not join the Tavus room.
- Do not use Tavus `memory_stores`.
- Do not put memory into `custom_greeting`.
- Do not add or register a webhook.
- Do not call Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflows, production DB, or production memory persistence.
