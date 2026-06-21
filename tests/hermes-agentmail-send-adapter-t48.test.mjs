import assert from "node:assert/strict";
import {
  AGENTMAIL_SEND_ADAPTER_VERSION,
  areAgentMailSendAdapterGatesOpen,
  buildAgentMailActionLedgerPreview,
  buildAgentMailSendAdapterReadiness,
  prepareAgentMailControlledSend,
  readAgentMailSendAdapterMode,
  runAgentMailPostSessionSends,
} from "../lib/xagent/agentMailSendAdapter.mjs";
import { buildHermesEmailCommunicationPlan } from "../lib/xagent/hermesEmailCommunicationsOperator.mjs";

const baseAgentMailEnv = {
  XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true",
  XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false",
  XAGENT_DANI_AGENTMAIL_ADDRESS: "danixagent@agentmail.to",
  AGENTMAIL_API_KEY: "am_us_inbox_send_adapter_secret",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

const previewEnv = {
  ...baseAgentMailEnv,
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED: "true",
  XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH: "false",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "preview",
};

const liveRequestedEnv = {
  ...previewEnv,
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "live",
  XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT: "admin@example.com",
};

const transcript = [
  {
    role: "user",
    content: "I run Vicks Law Firm and need after-hours intake support.",
  },
  {
    role: "user",
    content: "Please email me at rob@example.com with the recap.",
  },
  {
    role: "agent",
    content: "I can capture the request for the team.",
  },
];

function buildAction() {
  const plan = buildHermesEmailCommunicationPlan(
    {
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      transcript,
      transcriptMetadata: {},
      memoryOperatorResult: {
        memory_record_stored: true,
        memory_record_id: "hxemr_send_adapter",
      },
    },
    {
      env: {
        XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
      },
      now: "2026-06-21T15:00:00.000Z",
    },
  );
  return plan.actions[0];
}

function buildActions() {
  const plan = buildHermesEmailCommunicationPlan(
    {
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      transcript,
      transcriptMetadata: {},
      memoryOperatorResult: {
        memory_record_stored: true,
        memory_record_id: "hxemr_send_adapter",
      },
    },
    {
      env: {
        XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
      },
      now: "2026-06-21T15:00:00.000Z",
    },
  );
  return plan.actions;
}

function createMockAgentMailFetch() {
  const redisStore = new Map();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    if (url === "https://unit-test-upstash.invalid/pipeline") {
      const commands = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        async json() {
          return commands.map(([command, key, value]) => {
            if (command === "SET") {
              redisStore.set(key, value);
              return { result: "OK" };
            }
            if (command === "GET") {
              return { result: redisStore.get(key) ?? null };
            }
            return { error: `Unsupported command ${command}` };
          });
        },
      };
    }
    calls.push({ url, init });
    assert.equal(url, "https://api.agentmail.to/v0/inboxes/danixagent%40agentmail.to/messages/send");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer am_us_inbox_send_adapter_secret");
    const body = JSON.parse(init.body);
    assert.match(body.subject, /Dani|session|summary|intel|talking/i);
    assert.equal(typeof body.text, "string");
    assert.equal(body.text.length > 20, true);
    assert.equal(Array.isArray(body.labels), true);
    assert.equal(body.headers["X-XAgent-Conversation-ID"], "conv_agentmail_send_adapter_001");
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          message_id: `msg_${calls.length}`,
          thread_id: `thread_${calls.length}`,
        };
      },
    };
  };
  return { fetchImpl, calls, redisStore };
}

function assertNoLeak(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "am_us_inbox_send_adapter_secret",
    "rob@example.com",
    "test-recipient@example.com",
    "bearer ",
    "conversation_url",
    "custom_greeting",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

assert.equal(AGENTMAIL_SEND_ADAPTER_VERSION, "t48_agentmail_send_adapter_v1");
assert.equal(areAgentMailSendAdapterGatesOpen(previewEnv), true);
assert.equal(areAgentMailSendAdapterGatesOpen({
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED: "true ",
  XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED: "true ",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH: "false ",
}), true);
assert.equal(areAgentMailSendAdapterGatesOpen({}), false);
assert.equal(readAgentMailSendAdapterMode({}), "preview");
assert.equal(readAgentMailSendAdapterMode({ XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "live " }), "live");

{
  const readiness = buildAgentMailSendAdapterReadiness({
    env: {},
    now: "2026-06-21T15:00:00.000Z",
  });
  assert.equal(readiness.agentmail_send_adapter_code_present, true);
  assert.equal(readiness.agentmail_send_adapter_env_gates_open, false);
  assert.equal(readiness.agentmail_send_adapter_mode, "preview");
  assert.equal(readiness.agentmail_send_adapter_live_mode_requested, false);
  assert.equal(readiness.agentmail_send_adapter_ready_for_t49_one_send_test, false);
  assert.equal(readiness.agentmail_action_ledger_code_present, true);
  assert.equal(readiness.agentmail_action_ledger_persistence_enabled, false);
  assert.equal(readiness.agentmail_live_calls_enabled, false);
  assert.equal(readiness.agentmail_send_attempted, false);
  assert.equal(readiness.outbound_action_taken, false);
  assertNoLeak(readiness);
}

{
  const readiness = buildAgentMailSendAdapterReadiness({
    env: liveRequestedEnv,
    now: "2026-06-21T15:00:00.000Z",
  });
  assert.equal(readiness.agentmail_send_adapter_env_gates_open, true);
  assert.equal(readiness.agentmail_send_adapter_mode, "live");
  assert.equal(readiness.agentmail_send_adapter_live_mode_requested, true);
  assert.equal(readiness.agentmail_send_adapter_ready_for_t49_one_send_test, true);
  assert.equal(readiness.agentmail_admin_recipient_configured, true);
  assert.equal(readiness.agentmail_action_ledger_persistence_enabled, true);
  assert.equal(readiness.agentmail_live_calls_enabled, true);
  assert.equal(readiness.agentmail_send_attempted, false);
  assert.equal(readiness.agentmail_message_sent, false);
  assertNoLeak(readiness);
}

{
  const { fetchImpl, calls, redisStore } = createMockAgentMailFetch();
  const result = await runAgentMailPostSessionSends(
    {
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      actions: buildActions(),
      outboundContactEmail: "test-recipient@example.com",
    },
    {
      env: liveRequestedEnv,
      fetchImpl,
    },
  );
  assert.equal(calls.length, 3);
  assert.equal(redisStore.size, 3);
  const sentTo = calls.map((call) => JSON.parse(call.init.body).to);
  assert.deepEqual(sentTo, [
    "test-recipient@example.com",
    "admin@example.com",
    "admin@example.com",
  ]);
  assert.equal(result.agentmail_post_session_send_attempted, true);
  assert.equal(result.agentmail_post_session_send_status, "sent_or_partially_sent");
  assert.equal(result.agentmail_send_adapter_mode, "live");
  assert.equal(result.agentmail_message_sent, true);
  assert.equal(result.sent_count, 3);
  assert.equal(result.skipped_count, 0);
  assert.deepEqual(result.sent_action_types, [
    "email.user_followup",
    "email.admin_summary",
    "email.lead_intel",
  ]);
  assert.equal(result.live_agentmail_called, true);
  assert.equal(result.outbound_action_taken, true);
  assert.equal(result.action_claim_allowed, true);
  assertNoLeak(result);

  const duplicate = await runAgentMailPostSessionSends(
    {
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      actions: buildActions(),
      outboundContactEmail: "test-recipient@example.com",
    },
    {
      env: liveRequestedEnv,
      fetchImpl,
    },
  );
  assert.equal(calls.length, 3);
  assert.equal(duplicate.sent_count, 0);
  assert.equal(duplicate.agentmail_message_sent, false);
  assert.equal(duplicate.send_results.every((item) => item.send_status === "duplicate_send_prevented"), true);
  assertNoLeak(duplicate);
}

{
  const { fetchImpl, calls } = createMockAgentMailFetch();
  const result = await runAgentMailPostSessionSends(
    {
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      actions: buildActions(),
    },
    {
      env: liveRequestedEnv,
      fetchImpl,
    },
  );
  assert.equal(calls.length, 2);
  assert.equal(result.sent_count, 2);
  assert.equal(result.send_results[0].send_status, "recipient_unavailable");
  assert.equal(result.send_results[1].agentmail_message_sent, true);
  assert.equal(result.send_results[2].agentmail_message_sent, true);
  assertNoLeak(result);
}

{
  const action = buildAction();
  const prepared = prepareAgentMailControlledSend(
    {
      action,
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      recipientEmail: "test-recipient@example.com",
    },
    {
      env: previewEnv,
      now: "2026-06-21T15:00:00.000Z",
    },
  );
  assert.equal(prepared.agentmail_controlled_send_attempted, true);
  assert.equal(prepared.agentmail_controlled_send_prepared, true);
  assert.equal(prepared.agentmail_send_status, "preview_ready_live_send_blocked");
  assert.equal(prepared.agentmail_send_adapter_mode, "preview");
  assert.equal(prepared.agentmail_adapter_configured, true);
  assert.equal(prepared.ledger_preview.duplicate_send_prevention_ready, true);
  assert.equal(prepared.ledger_preview.persistence_required_before_live_send, true);
  assert.equal(prepared.ledger_preview.recipient_supplied, true);
  assert.equal(prepared.ledger_preview.recipient_hash_present, true);
  assert.equal(prepared.payload_preview.agentmail_method_preview, "client.inboxes.messages.send");
  assert.equal(prepared.payload_preview.agentmail_inbox_address, "danixagent@agentmail.to");
  assert.equal(prepared.text_preview_present, true);
  assert.equal(prepared.actual_recipient_included, false);
  assert.equal(prepared.api_key_included, false);
  assert.equal(prepared.live_agentmail_called, false);
  assert.equal(prepared.agentmail_send_attempted, false);
  assert.equal(prepared.agentmail_message_sent, false);
  assert.equal(prepared.action_claim_allowed, false);
  assertNoLeak(prepared);
}

{
  const action = buildAction();
  const liveBlocked = prepareAgentMailControlledSend(
    {
      action,
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      recipientEmail: "test-recipient@example.com",
    },
    {
      env: liveRequestedEnv,
      now: "2026-06-21T15:00:00.000Z",
    },
  );
  assert.equal(liveBlocked.agentmail_controlled_send_attempted, true);
  assert.equal(liveBlocked.agentmail_controlled_send_prepared, false);
  assert.equal(liveBlocked.agentmail_send_status, "live_send_blocked_until_t49_one_send_approval");
  assert.equal(liveBlocked.agentmail_send_adapter_live_mode_requested, true);
  assert.equal(liveBlocked.live_agentmail_called, false);
  assert.equal(liveBlocked.agentmail_send_attempted, false);
  assert.equal(liveBlocked.agentmail_message_sent, false);
  assertNoLeak(liveBlocked);
}

{
  const disabled = prepareAgentMailControlledSend(
    {
      action: buildAction(),
      provider_conversation_id: "conv_agentmail_send_adapter_001",
      recipientEmail: "test-recipient@example.com",
    },
    { env: {} },
  );
  assert.equal(disabled.agentmail_controlled_send_attempted, false);
  assert.equal(disabled.agentmail_controlled_send_prepared, false);
  assert.equal(disabled.agentmail_send_status, "send_adapter_disabled");
  assert.equal(disabled.agentmail_send_attempted, false);
  assertNoLeak(disabled);
}

{
  await assert.rejects(
    async () => buildAgentMailActionLedgerPreview({
      payloadPreview: {},
      recipientEmail: "not-an-email",
    }),
    /recipient email must be a valid email address/,
  );
}

console.log("Hermes AgentMail send adapter T48 checks passed");
