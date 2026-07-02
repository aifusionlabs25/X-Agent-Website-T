import assert from "node:assert/strict";
import {
  storeConversationEmailMappingForStart,
  storeEmailMemoryFromConversationTranscript,
} from "../lib/xagent/emailMemoryStore.mjs";
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
  XAGENT_HAL_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
  XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
  XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true",
  XAGENT_HAL_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false",
  XAGENT_HAL_AGENTMAIL_ADDRESS: "hermes-hal@agentmail.to",
  HAL_AGENTMAIL_API_KEY: "am_us_hal_agentmail_unit_test_secret",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED: "true",
  XAGENT_HAL_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED: "true",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH: "false",
  XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "live",
  XAGENT_HAL_HERMES_EMAIL_ADMIN_RECIPIENT: "operator@example.com",
  XAGENT_AI_FUSION_CALENDLY_URL: "https://calendly.com/aifusionlabs",
  XAGENT_EMAIL_IDENTITY_SALT: "hal-agentmail-unit-test-salt",
  XAGENT_TAVUS_CALLBACK_TOKEN: "unit-test-callback-token",
  UPSTASH_REDIS_REST_URL: "https://hal-agentmail-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "hal-agentmail-unit-test-token",
};

function createMockFetch() {
  const redisStore = new Map();
  const agentMailCalls = [];
  const fetchImpl = async (url, init = {}) => {
    if (url === "https://hal-agentmail-upstash.invalid/pipeline") {
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

    assert.equal(url, "https://api.agentmail.to/v0/inboxes/hermes-hal%40agentmail.to/messages/send");
    agentMailCalls.push({ url, init });
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer am_us_hal_agentmail_unit_test_secret");
    const body = JSON.parse(init.body);
    assert.equal(body.headers["X-XAgent-Conversation-ID"], "conv_hal_agentmail_live_001");
    assert.equal(Array.isArray(body.labels), true);
    assert.equal(body.labels.includes("hal"), true);
    assert.equal(body.labels.includes("dani"), false);
    assert.match(body.subject, /Hal|Lead intel|session/i);
    assert.equal(body.text.includes("Dani"), false);
    assert.equal(body.html.includes("Dani"), false);
    if (body.headers["X-XAgent-Action-Type"] === "email.user_followup") {
      assert.match(body.subject, /executive-autopilot next steps/i);
      assert.match(body.text, /TL;DR/);
      assert.match(body.text, /Executive Artifact/);
      assert.match(body.text, /Execution Boundary/);
      assert.match(body.text, /Human Handoff \/ Next Steps/);
      assert.match(body.text, /No meeting, email, CRM update, or external action/i);
      assert.match(body.html, /TL;DR \/ Session Brief/);
      assert.match(body.html, /Executive Artifact/);
      assert.match(body.html, /HAL \/\/ EXECUTIVE AUTOPILOT/);
      assert.match(body.html, /Operator<br>memo/);
      assert.match(body.html, /#f2eadc/);
    }
    if (body.headers["X-XAgent-Action-Type"] === "email.admin_summary") {
      assert.match(body.subject, /Hal admin brief/i);
      assert.match(body.text, /Session Details/);
      assert.match(body.text, /Generated at:/);
      assert.match(body.text, /Conversation ID: conv_hal_agentmail_live_001/);
      assert.match(body.text, /Executive Artifact/);
      assert.match(body.html, /Hal Session Operations Brief/);
      assert.match(body.html, /Review Hal Operations Brief/);
    }
    if (body.headers["X-XAgent-Action-Type"] === "email.lead_intel") {
      assert.match(body.subject, /HAL AUTOPILOT FIT/i);
      assert.match(body.text, /Executive Autopilot Readout/);
      assert.match(body.text, /Executive Artifact/);
      assert.match(body.text, /Autopilot Signals/);
      assert.match(body.html, /Open Executive Brief/);
      assert.match(body.html, /Autopilot where safe\. Human judgment where it matters\./);
      assert.equal(body.attachments.length, 1);
      assert.equal(body.attachments[0].filename, "hal-transcript-conv_hal_agentmail_live_001.txt");
      const decoded = Buffer.from(body.attachments[0].content, "base64").toString("utf8");
      assert.match(decoded, /^Hal X Agent Transcript/);
      assert.equal(decoded.includes("system-only turn"), false);
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          message_id: `msg_hal_${agentMailCalls.length}`,
          thread_id: `thread_hal_${agentMailCalls.length}`,
        };
      },
    };
  };
  return { fetchImpl, redisStore, agentMailCalls };
}

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "visitor@example.com",
    "operator@example.com",
    "hal-agentmail-unit-test-salt",
    "hal-agentmail-unit-test-token",
    "am_us_hal_agentmail_unit_test_secret",
    "bearer ",
    "api_key",
    "custom_greeting",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const { fetchImpl, agentMailCalls, redisStore } = createMockFetch();
const agentOptions = { agentSlug: "hal", env: envOpen, fetchImpl };

await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "visitor@example.com", display_name: "Rob" },
    session_id: "xagent_session_hal_agentmail_prior_001",
    provider_conversation_id: "conv_hal_agentmail_prior_001",
    started_at: 1760000000000,
  },
  agentOptions,
);

await storeEmailMemoryFromConversationTranscript(
  {
    provider_conversation_id: "conv_hal_agentmail_prior_001",
    transcript: [
      { role: "user", content: "Tell Hal I care about autopilot boundaries and an executive briefing follow-up." },
      { role: "agent", content: "I can prepare approved follow-up notes and hand back decisions that need a human." },
    ],
  },
  agentOptions,
);

await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "visitor@example.com", display_name: "Rob" },
    session_id: "xagent_session_hal_agentmail_live_001",
    provider_conversation_id: "conv_hal_agentmail_live_001",
    started_at: 1760001000000,
  },
  agentOptions,
);

const result = await handleTavusTranscriptionMemoryWebhook(
  {
    conversation_id: "conv_hal_agentmail_live_001",
    event_type: "application.transcription_ready",
    properties: {
      transcript: [
        { role: "system", content: "system-only turn" },
        { role: "user", content: "Hal, please email me the executive autopilot recap and include the briefing next steps." },
        { role: "assistant", content: "I can capture that for the team." },
        { role: "user", content: "Make the focus Brian-style decision handoff and meeting prep." },
      ],
    },
  },
  {
    ...agentOptions,
    callbackToken: "unit-test-callback-token",
  },
);

assert.equal(result.agent_slug, "hal");
assert.equal(result.memory_record_stored, true);
assert.equal(result.hermes_email_actions_planned, true);
assert.equal(result.hermes_email_action_count, 3);
assert.equal(result.agentmail_post_session_send_attempted, true);
assert.equal(result.agentmail_message_sent, true);
assert.equal(result.live_agentmail_called, true);
assert.equal(result.action_claim_allowed, true);
assert.equal(agentMailCalls.length, 3);
assert.equal([...redisStore.keys()].some((key) => key.includes(":hal:agentmail-send:conv_hal_agentmail_live_001")), true);
assert.equal([...redisStore.keys()].some((key) => key.includes(":dani:agentmail-send:conv_hal_agentmail_live_001")), false);
assertNoUnsafeValue(result);

const status = await buildHermesEmailActionStatusLookup(
  { provider_conversation_id: "conv_hal_agentmail_live_001", agentSlug: "hal" },
  agentOptions,
);
assert.equal(status.email_action_status_checked, true);
assert.equal(status.email_action_status_available, true);
assert.equal(status.agentmail_send_attempted, true);
assert.equal(status.agentmail_message_sent, true);
assert.equal(status.send_count, 3);
assertNoUnsafeValue(status);

console.log("Hal AgentMail post-session send checks passed");
