import assert from "node:assert/strict";
import {
  AGENTMAIL_ADAPTER_READINESS_VERSION,
  areAgentMailAdapterGatesOpen,
  buildAgentMailAdapterReadiness,
  buildAgentMailSendPayloadPreview,
  DANI_AGENTMAIL_ADDRESS,
  normalizeAgentMailAddress,
  readAgentMailAdapterConfig,
} from "../lib/xagent/agentMailAdapterReadiness.mjs";
import { buildHermesEmailCommunicationPlan } from "../lib/xagent/hermesEmailCommunicationsOperator.mjs";

const openEnv = {
  XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true",
  XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false",
  XAGENT_DANI_AGENTMAIL_ADDRESS: "danixagent@agentmail.to",
  AGENTMAIL_API_KEY: "am_us_inbox_unit_test_secret_never_print",
};

const transcript = [
  {
    role: "user",
    content: "I run Vicks Law Firm and need after-hours intake support.",
  },
  {
    role: "user",
    content: "Email me at rob@example.com after you prepare the recap.",
  },
  {
    role: "agent",
    content: "I can capture the request for follow-up after review.",
  },
];

function assertNoSecretOrRawEmail(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "am_us_inbox_unit_test_secret_never_print",
    "rob@example.com",
    "api key",
    "bearer ",
    "custom_greeting",
    "conversation_url",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

assert.equal(AGENTMAIL_ADAPTER_READINESS_VERSION, "t47_agentmail_adapter_readiness_v1");
assert.equal(DANI_AGENTMAIL_ADDRESS, "danixagent@agentmail.to");
assert.equal(normalizeAgentMailAddress(" DaniXAgent@AgentMail.To "), "danixagent@agentmail.to");
await assert.rejects(
  async () => normalizeAgentMailAddress("not an inbox"),
  /valid email address/,
);

assert.equal(areAgentMailAdapterGatesOpen(openEnv), true);
assert.equal(areAgentMailAdapterGatesOpen({
  XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true ",
  XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true ",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false ",
}), true);
assert.equal(areAgentMailAdapterGatesOpen({}), false);

{
  const config = readAgentMailAdapterConfig(openEnv);
  assert.equal(config.gatesOpen, true);
  assert.equal(config.inboxAddress, "danixagent@agentmail.to");
  assert.equal(config.inboxAddressConfigured, true);
  assert.equal(config.inboxAddressMatchesDani, true);
  assert.equal(config.apiKeyPresent, true);
  assertNoSecretOrRawEmail(config);
}

{
  const readiness = buildAgentMailAdapterReadiness({
    env: openEnv,
    now: "2026-06-21T14:00:00.000Z",
  });
  assert.equal(readiness.adapter_version, AGENTMAIL_ADAPTER_READINESS_VERSION);
  assert.equal(readiness.checked_at, "2026-06-21T14:00:00.000Z");
  assert.equal(readiness.agentmail_adapter_code_present, true);
  assert.equal(readiness.agentmail_adapter_env_gates_open, true);
  assert.equal(readiness.agentmail_inbox_address_configured, true);
  assert.equal(readiness.agentmail_inbox_address, "danixagent@agentmail.to");
  assert.equal(readiness.expected_dani_agentmail_address, "danixagent@agentmail.to");
  assert.equal(readiness.agentmail_inbox_matches_dani, true);
  assert.equal(readiness.agentmail_api_key_present, true);
  assert.equal(readiness.agentmail_api_key_value_included, false);
  assert.equal(readiness.agentmail_sdk_installed, false);
  assert.equal(readiness.agentmail_sdk_required_for_t47, false);
  assert.equal(readiness.agentmail_live_calls_enabled, false);
  assert.equal(readiness.agentmail_inbox_created_by_code, false);
  assert.equal(readiness.agentmail_send_attempted, false);
  assert.equal(readiness.agentmail_message_sent, false);
  assert.equal(readiness.outbound_action_taken, false);
  assertNoSecretOrRawEmail(readiness);
}

{
  const closedReadiness = buildAgentMailAdapterReadiness({
    env: {},
    now: "2026-06-21T14:00:00.000Z",
  });
  assert.equal(closedReadiness.agentmail_adapter_env_gates_open, false);
  assert.equal(closedReadiness.agentmail_inbox_address_configured, false);
  assert.equal(closedReadiness.agentmail_api_key_present, false);
  assert.equal(closedReadiness.agentmail_live_calls_enabled, false);
  assertNoSecretOrRawEmail(closedReadiness);
}

{
  const plan = buildHermesEmailCommunicationPlan(
    {
      provider_conversation_id: "conv_agentmail_preview_001",
      transcript,
      transcriptMetadata: {},
      memoryOperatorResult: {
        memory_record_stored: true,
        memory_record_id: "hxemr_agentmail_preview",
      },
    },
    {
      env: {
        XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
      },
      now: "2026-06-21T14:00:00.000Z",
    },
  );
  const preview = buildAgentMailSendPayloadPreview({
    action: plan.actions[0],
    provider_conversation_id: "conv_agentmail_preview_001",
    inboxAddress: "danixagent@agentmail.to",
  });

  assert.equal(preview.adapter_version, AGENTMAIL_ADAPTER_READINESS_VERSION);
  assert.equal(preview.agentmail_method_preview, "client.inboxes.messages.send");
  assert.equal(preview.agentmail_inbox_address, "danixagent@agentmail.to");
  assert.equal(preview.agentmail_client_id, "xagent:ai-fusion-labs:dani:conv_agentmail_preview_001:email.user_followup");
  assert.equal(preview.agentmail_client_id_hash.length, 64);
  assert.equal(preview.action_type, "email.user_followup");
  assert.equal(preview.actual_to_included, false);
  assert.equal(preview.html_included, false);
  assert.equal(preview.attachments_included, false);
  assert.equal(preview.api_key_included, false);
  assert.equal(preview.live_agentmail_called, false);
  assert.equal(preview.agentmail_send_attempted, false);
  assert.equal(preview.agentmail_message_sent, false);
  assert.equal(preview.action_claim_allowed, false);
  assertNoSecretOrRawEmail(preview);
}

console.log("Hermes AgentMail adapter readiness T47 checks passed");
