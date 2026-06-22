import assert from "node:assert/strict";
import { storeConversationEmailMappingForStart } from "../lib/xagent/emailMemoryStore.mjs";
import { buildHermesEmailActionStatusLookup } from "../lib/xagent/hermesEmailActionStatusStore.mjs";
import { handleTavusTranscriptionMemoryWebhook } from "../lib/xagent/tavusTranscriptionMemoryWebhook.mjs";

const envOpen = {
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_OUTBOUND_CONTACT_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_KILL_SWITCH: "false",
  XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED: "true",
  XAGENT_DANI_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED: "true",
  XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH: "false",
  XAGENT_HERMES_MEMORY_OPERATOR_ENABLED: "true",
  XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED: "true",
  XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH: "false",
  XAGENT_HERMES_MEMORY_OPERATOR_MODE: "embedded",
  XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
  XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
  XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
  XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true",
  XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false",
  XAGENT_DANI_AGENTMAIL_ADDRESS: "danixagent@agentmail.to",
  AGENTMAIL_API_KEY: "am_us_inbox_live_send_test_secret",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED: "true",
  XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH: "false",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "live",
  XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT: "admin@example.com",
  XAGENT_AI_FUSION_CALENDLY_URL: "https://calendly.com/aifusionlabs",
  XAGENT_EMAIL_IDENTITY_SALT: "unit-test-production-shaped-salt",
  XAGENT_TAVUS_CALLBACK_TOKEN: "unit-test-callback-token",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

function createMockFetch() {
  const redisStore = new Map();
  const agentMailCalls = [];
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

    if (url === "https://api.agentmail.to/v0/inboxes/danixagent%40agentmail.to/messages/send") {
      agentMailCalls.push({ url, init });
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer am_us_inbox_live_send_test_secret");
      const body = JSON.parse(init.body);
      assert.equal(typeof body.subject, "string");
      assert.equal(typeof body.text, "string");
      assert.equal(body.text.length > 20, true);
      assert.equal(Array.isArray(body.labels), true);
      assert.equal(body.headers["X-XAgent-Conversation-ID"], "conv_agentmail_live_webhook_001");
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            message_id: `msg_live_${agentMailCalls.length}`,
            thread_id: `thread_live_${agentMailCalls.length}`,
          };
        },
      };
    }

    throw new Error(`unexpected fetch URL ${url}`);
  };
  return { fetchImpl, redisStore, agentMailCalls };
}

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "visitor@example.com",
    "admin@example.com",
    "unit-test-production-shaped-salt",
    "unit-test-token",
    "am_us_inbox_live_send_test_secret",
    "bearer ",
    "conversation_url",
    "custom_greeting",
    "api_key",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

function assertNoOldTranscriptDumpPhrasing(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "safe recap prepared",
    "visitor/business context",
    "primary safe signals",
    "memory summary:",
    "here is the safe recap",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `kept old email phrasing: ${forbidden}`);
  }
}

const { fetchImpl, redisStore, agentMailCalls } = createMockFetch();
await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "Visitor@Example.com" },
    session_id: "xagent_session_agentmail_live_webhook_001",
    provider_conversation_id: "conv_agentmail_live_webhook_001",
    started_at: 1760000000000,
  },
  { env: envOpen, fetchImpl },
);

const callbackPayload = {
  conversation_id: "conv_agentmail_live_webhook_001",
  event_type: "application.transcription_ready",
  message_type: "application",
  timestamp: "2026-06-21T12:00:00.000Z",
  properties: {
    transcript: [
      { role: "system", content: "internal system turn" },
      { role: "user", content: "Hey Dani, I'm calling back. I run Vicks Law Firm and need legal intake support." },
      { role: "assistant", content: "We can capture the request for the team." },
      { role: "user", content: "Please send a follow-up email with a meeting invitation for Tuesday at 10 a.m." },
      { role: "user", content: "Focus the demo on intake, scheduling, and follow-up for my law firm." },
    ],
  },
};

const result = await handleTavusTranscriptionMemoryWebhook(callbackPayload, {
  env: envOpen,
  fetchImpl,
  callbackToken: "unit-test-callback-token",
});

assert.equal(result.transcription_ready_processed, true);
assert.equal(result.memory_record_stored, true);
assert.equal(result.hermes_email_actions_planned, true);
assert.equal(result.hermes_email_action_count, 3);
assert.equal(result.hermes_email_live_send_count, 3);
assert.deepEqual(result.hermes_email_live_sent_action_types, [
  "email.user_followup",
  "email.admin_summary",
  "email.lead_intel",
]);
assert.equal(result.agentmail_post_session_send_attempted, true);
assert.equal(result.agentmail_post_session_send_status, "sent_or_partially_sent");
assert.equal(result.agentmail_message_sent, true);
assert.equal(result.live_agentmail_called, true);
assert.equal(result.action_claim_allowed, true);
assert.equal(result.resend_called, false);
assert.equal(result.live_hermes_called, false);
assert.equal(result.openai_called, false);
assert.equal(result.ollama_generate_called, false);
assert.equal(agentMailCalls.length, 3);

const sentPayloads = agentMailCalls.map((call) => JSON.parse(call.init.body));
assert.deepEqual(new Set(sentPayloads.map((payload) => payload.subject)).size, 3);
assert.deepEqual(new Set(sentPayloads.map((payload) => payload.text)).size, 3);
assert.match(sentPayloads[0].text, /Thanks for checking back in with Dani/i);
assert.match(sentPayloads[0].text, /Vicks Law Firm/);
assert.match(sentPayloads[0].text, /Tuesday at 10 a\.m\./i);
assert.match(sentPayloads[0].text, /30-minute Dani Demo Call/i);
assert.match(sentPayloads[0].text, /https:\/\/calendly\.com\/aifusionlabs/);
assert.match(sentPayloads[1].text, /Conversation ID: conv_agentmail_live_webhook_001/);
assert.match(sentPayloads[1].text, /Calendly CTA included: yes/);
assert.match(sentPayloads[1].text, /visitor requested a meeting\/demo/);
assert.match(sentPayloads[1].text, /Recommended operator action/i);
assert.match(sentPayloads[2].text, /Lead temperature: returning warm lead/i);
assert.match(sentPayloads[2].text, /Calendly CTA included: yes/);
assert.match(sentPayloads[2].text, /Suggested next move/i);
assertNoOldTranscriptDumpPhrasing(sentPayloads);

const recipients = agentMailCalls.map((call) => JSON.parse(call.init.body).to);
assert.deepEqual(recipients, [
  "visitor@example.com",
  "admin@example.com",
  "admin@example.com",
]);

const actionStatus = await buildHermesEmailActionStatusLookup(
  { provider_conversation_id: "conv_agentmail_live_webhook_001" },
  { env: envOpen, fetchImpl },
);
assert.equal(actionStatus.email_action_status_available, true);
assert.equal(actionStatus.email_action_status, "draft_plan_created");
assert.equal(actionStatus.send_count, 3);
assert.deepEqual(actionStatus.sent_action_types, [
  "email.user_followup",
  "email.admin_summary",
  "email.lead_intel",
]);
assert.equal(actionStatus.agentmail_send_attempted, true);
assert.equal(actionStatus.agentmail_message_sent, true);
assert.equal(actionStatus.action_claim_allowed, true);
assertNoUnsafeValue(result);
assertNoUnsafeValue(actionStatus);

const storedValues = [...redisStore.values()].join("\n").toLowerCase();
assert.equal(storedValues.includes("am_us_inbox_live_send_test_secret"), false);
assert.equal(storedValues.includes("bearer "), false);

console.log("Hermes Tavus AgentMail live send T49 checks passed");
