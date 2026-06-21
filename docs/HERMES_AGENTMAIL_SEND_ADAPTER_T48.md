# Hermes AgentMail Send Adapter T48

Phase T48 adds the controlled AgentMail send adapter airlock for Dani.

This phase does not send email, call AgentMail, install the AgentMail SDK, call Resend, call Hermes Gateway, call OpenAI/Codex, call Ollama, create Tavus conversations, join rooms, update CRM, register webhooks, or mutate production memory.

## What T48 Adds

T48 prepares the shape required for a future one-send AgentMail test:

- AgentMail send adapter readiness
- send mode gates
- idempotency and ledger preview
- controlled-send payload preview from a T46 draft action
- explicit live-send block until T49

The adapter can validate a target recipient internally, but it does not return or store the raw recipient address.

## Gates

The send adapter is disabled unless these gates are open:

- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED=true`
- `XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED=true`
- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH=false`

Mode:

- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE=preview`
- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE=live`

Even when `live` is requested, T48 still reports:

- `agentmail_live_calls_enabled=false`
- `agentmail_send_attempted=false`
- `agentmail_message_sent=false`

That prevents an accidental email before the T49 one-send test is explicitly approved.

## Idempotency

T48 builds a ledger preview from:

- tenant
- agent
- provider conversation ID
- email action type
- AgentMail client ID hash
- recipient hash

The preview records:

- `duplicate_send_prevention_ready=true`
- `persistence_required_before_live_send=true`
- raw recipient omitted
- API key omitted
- payload text omitted from the ledger preview

Live sending should not be enabled until the ledger reservation/write path is persistent.

## Runtime Readiness

`/api/xagent/runtime-readiness` now exposes:

- `agentmail_send_adapter_code_present`
- `agentmail_send_adapter_env_gates_open`
- `agentmail_send_adapter_mode`
- `agentmail_send_adapter_live_mode_requested`
- `agentmail_send_adapter_ready_for_t49_one_send_test`
- `agentmail_action_ledger_code_present`
- `agentmail_action_ledger_persistence_enabled`

The expected safe state before T49 is:

- `agentmail_send_adapter_ready_for_t49_one_send_test=true` only when all AgentMail config and send gates are present
- `agentmail_live_calls_enabled=false`

## Next Step

T49 should be one explicit, controlled live AgentMail send test only after:

1. The production readiness endpoint confirms T48 code and config.
2. The human provides the exact test recipient.
3. The send content is approved.
4. The action ledger persistence decision is made.

## Validation

```powershell
npm run test:hermes-agentmail-send-adapter-t48
npm run test:hermes-agentmail-adapter-readiness-t47
npm run test:hermes-email-communications-operator-t46
npm run test:hermes-runtime-readiness
npm run lint
npx tsc --noEmit
npm run build
```
