# Hermes AgentMail Adapter Readiness T47

Phase T47 adds an AgentMail adapter readiness contract for Dani.

This phase does not call AgentMail, send email, create inboxes, install the AgentMail SDK, call Resend, call Hermes Gateway, call OpenAI/Codex, call Ollama, create Tavus conversations, join rooms, update CRM, register webhooks, or mutate production memory.

## Dani AgentMail Inbox

The Dani inbox created in AgentMail is:

- address: `danixagent@agentmail.to`
- role: replyable X Agent inbox candidate
- current use: configuration/readiness only

The AgentMail API key must be stored only as an environment variable. It must not be committed, printed, stored in proof files, returned from readiness endpoints, or echoed in logs.

## Env Contract

The adapter is disabled unless these gates are open:

- `XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED=true`
- `XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED=true`
- `XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH=false`

Configuration:

- `XAGENT_DANI_AGENTMAIL_ADDRESS=danixagent@agentmail.to`
- `AGENTMAIL_API_KEY=<secret>`

Runtime readiness exposes only safe booleans:

- `agentmail_adapter_code_present`
- `agentmail_adapter_env_gates_open`
- `agentmail_inbox_address_configured`
- `agentmail_inbox_matches_dani`
- `agentmail_api_key_present`
- `agentmail_live_calls_enabled=false`

It does not expose the API key.

## Adapter Preview

T47 can build a future AgentMail send payload preview from a T46 email draft action.

The preview models the current AgentMail TypeScript SDK shape:

```typescript
client.inboxes.messages.send(inboxId, {
  to,
  subject,
  text,
  html,
})
```

The preview also models AgentMail idempotency with a deterministic `clientId`-shaped value. T47 stores only the hash plus safe metadata. It does not include an actual `to` address, API key, or live-send request.

## Provider Decision

Keep the split from T46:

- Resend remains the safest first controlled outbound-send adapter.
- AgentMail is the better long-term replyable agent inbox and inbound-thread workflow candidate.

The first live AgentMail phase should wait until:

1. We have an action ledger.
2. We have idempotency persisted.
3. Operator review can approve/deny sends.
4. We have a narrow one-send test plan.

## Validation

```powershell
npm run test:hermes-agentmail-adapter-readiness-t47
npm run test:hermes-email-communications-operator-t46
npm run test:hermes-runtime-readiness
npm run lint
npx tsc --noEmit
npm run build
```
