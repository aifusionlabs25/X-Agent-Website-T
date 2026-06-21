# Hermes Email Memory Operator T45

Phase T45 moves the post-session memory write behind a Hermes-shaped operator boundary in `x-agent-website-t`.

The normal production sequence is now:

1. Dani starts a Tavus conversation through `/api/conversation/start`.
2. The site stores the app-owned email identity mapping for the Tavus conversation ID.
3. Tavus sends `application.transcription_ready` to `/api/webhook`.
4. The webhook extracts user/agent transcript turns.
5. `runHermesEmailMemoryOperator()` owns the memory operation.
6. The existing Upstash memory store receives only the safe memory record.

## Operator Modes

### Embedded Mode

`XAGENT_HERMES_MEMORY_OPERATOR_MODE=embedded`

Embedded mode is the first production-safe operator lane. It uses the repo-local deterministic summary path, records Hermes operator metadata on the memory record, and does not call a live Hermes Gateway.

Required gates:

- `XAGENT_HERMES_MEMORY_OPERATOR_ENABLED=true`
- `XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED=true`
- `XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH=false`
- `XAGENT_HERMES_MEMORY_OPERATOR_MODE=embedded`

### Gateway Mode

`XAGENT_HERMES_MEMORY_OPERATOR_MODE=gateway`

Gateway mode is the future live Hermes handoff seam. It requires:

- `XAGENT_HERMES_GATEWAY_URL`
- `XAGENT_HERMES_GATEWAY_TOKEN`
- optional `XAGENT_HERMES_GATEWAY_TIMEOUT_MS`

Gateway mode was tested with a mocked Hermes endpoint only. Do not enable it in production until the real Hermes Gateway contract is approved and monitored.

## Closed-Gate Compatibility

If the Hermes operator gates are closed, the webhook keeps the current email-memory behavior alive through an embedded compatibility fallback. The response and stored metadata record `hermes_operator_invoked=false` and `hermes_operator_status=embedded_fallback_because_gates_closed`.

This prevents a missed env variable from breaking post-session memory while still making it clear that the Hermes operator gate was not actually open.

## Boundaries

T45 does not add:

- outbound email or CRM actions
- Resend calls
- OpenAI/Codex calls
- Ollama calls
- Tavus room joins
- Tavus `memory_stores`
- memory in `custom_greeting`
- public UI changes

The only approved production write remains the existing email-identity memory record in Upstash.

## Validation

Focused validation:

```powershell
npm run test:hermes-email-memory-operator-t45
npm run test:hermes-tavus-transcription-memory-webhook-t41
```

Broader adjacent validation:

```powershell
npm run test:hermes-email-memory-store-t41
npm run test:hermes-email-memory-store-status-t42
npm run test:hermes-tavus-memory-prompt-preview
npm run lint
npx tsc --noEmit
npm run build
```
