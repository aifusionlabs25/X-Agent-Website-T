# Hermes AgentMail Live Send T49

Phase T49 enables a controlled live AgentMail send path for Dani post-session emails.

## What Runs

After Tavus sends `application.transcription_ready`, the backend sequence is:

1. Store/update email memory from the transcript.
2. Build Hermes email action drafts:
   - `email.user_followup`
   - `email.admin_summary`
   - `email.lead_intel`
3. If AgentMail live-send gates are open, send those actions through AgentMail.
4. Store safe email-action status by `provider_conversation_id`.

## Recipient Rules

The visitor follow-up email is sent only to the typed Memory Check-In email, and only when outbound contact storage is explicitly enabled.

Admin emails are sent only to `XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT`.

The system does not send to a spoken transcript email. This avoids transcription errors like `rvicks` becoming `rbicks`.

## Required Vercel Env

Existing gates must remain open:

- `XAGENT_EMAIL_MEMORY_STORE_ENABLED=true`
- `XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED=true`
- `XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH=false`
- `XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED=true`
- `XAGENT_DANI_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED=true`
- `XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH=false`
- `XAGENT_HERMES_MEMORY_OPERATOR_ENABLED=true`
- `XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED=true`
- `XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH=false`
- `XAGENT_HERMES_EMAIL_ACTIONS_ENABLED=true`
- `XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED=true`
- `XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH=false`
- `XAGENT_HERMES_EMAIL_ACTIONS_MODE=draft_only`
- `XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER=agentmail`
- `XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED=true`
- `XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED=true`
- `XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH=false`
- `XAGENT_DANI_AGENTMAIL_ADDRESS=danixagent@agentmail.to`
- `AGENTMAIL_API_KEY=<secret>`
- `UPSTASH_REDIS_REST_URL=<secret>`
- `UPSTASH_REDIS_REST_TOKEN=<secret>`
- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED=true`
- `XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED=true`
- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH=false`

New T49 gates:

- `XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_ENABLED=true`
- `XAGENT_DANI_EMAIL_OUTBOUND_CONTACT_STORE_PILOT_ENABLED=true`
- `XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_KILL_SWITCH=false`
- `XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE=live`
- `XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT=<internal operator email>`

Optional override:

- `AGENTMAIL_API_BASE_URL=https://api.agentmail.to`

## Safe Status Check

After a completed session, check:

```bash
POST /api/xagent/email-actions/status
{
  "provider_conversation_id": "..."
}
```

Expected successful live-send fields:

- `email_action_status_available=true`
- `send_count=3`
- `sent_action_types=["email.user_followup","email.admin_summary","email.lead_intel"]`
- `agentmail_message_sent=true`
- `resend_called=false`
- `openai_called=false`
- `ollama_generate_called=false`

## Boundaries

T49 does not call Resend, OpenAI, Ollama, Hermes Gateway, or Tavus outside the existing Tavus webhook. It does not send to transcript-spoken email addresses. It does not store AgentMail API keys, message bodies, raw transcript content, or room URLs in status artifacts.
