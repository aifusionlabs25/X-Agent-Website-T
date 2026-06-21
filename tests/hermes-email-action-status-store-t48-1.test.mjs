import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildHermesEmailActionStatusLookup,
  buildHermesEmailActionStatusRecord,
  HERMES_EMAIL_ACTION_STATUS_STORE_VERSION,
  storeHermesEmailActionStatus,
} from "../lib/xagent/hermesEmailActionStatusStore.mjs";
import { runHermesEmailCommunicationsOperator } from "../lib/xagent/hermesEmailCommunicationsOperator.mjs";

const envOpen = {
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

const emailActionEnv = {
  XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
  XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
  XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
  XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
};

function createMockRedisFetch() {
  const store = new Map();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    assert.equal(url, "https://unit-test-upstash.invalid/pipeline");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer unit-test-token");
    const commands = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return commands.map(([command, key, value]) => {
          if (command === "SET") {
            store.set(key, value);
            return { result: "OK" };
          }
          if (command === "GET") {
            return { result: store.get(key) ?? null };
          }
          return { error: `Unsupported command ${command}` };
        });
      },
    };
  };
  return { fetchImpl, store, calls };
}

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "rob@example.com",
    "rvics@gmail.com",
    "gmail dot com",
    "unit-test-token",
    "bearer ",
    "api_key",
    "conversation_url",
    "body_text_preview",
    "subject_preview",
    "thanks for spending time",
    "vicks law firm",
    "after-hours weekend intake",
    "transcript",
    "messages",
    "content",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const transcript = [
  {
    role: "user",
    content: "Hey Dani, I run Vicks Law Firm and need after-hours weekend intake help.",
  },
  {
    role: "agent",
    content: "Got it. Are you looking for intake, scheduling, or follow-up?",
  },
  {
    role: "user",
    content: "My email is rob@example.com and I want a technical call next Tuesday.",
  },
];

const communicationsResult = await runHermesEmailCommunicationsOperator(
  {
    provider_conversation_id: "conv_email_status_test_001",
    transcript,
    transcriptMetadata: {
      source_turn_count: 3,
      retained_memory_turn_count: 3,
    },
    memoryOperatorResult: {
      memory_record_stored: true,
      memory_record_id: "hxemr_not_returned_in_status",
    },
  },
  { env: emailActionEnv, now: "2026-06-21T12:00:00.000Z" },
);

const record = buildHermesEmailActionStatusRecord(
  {
    provider_conversation_id: "conv_email_status_test_001",
    communicationsResult,
    memoryOperatorResult: {
      memory_record_stored: true,
    },
  },
  { now: "2026-06-21T12:01:00.000Z" },
);
assert.equal(record.schema_version, HERMES_EMAIL_ACTION_STATUS_STORE_VERSION);
assert.equal(record.provider_conversation_id, "conv_email_status_test_001");
assert.equal(record.email_action_plan_status, "draft_plan_created");
assert.equal(record.email_action_plan_created, true);
assert.equal(record.email_action_mode, "draft_only");
assert.equal(record.email_action_provider, "agentmail");
assert.equal(record.action_count, 3);
assert.equal(record.draft_count, 3);
assert.equal(record.send_count, 0);
assert.deepEqual(record.action_types, [
  "email.user_followup",
  "email.admin_summary",
  "email.lead_intel",
]);
assert.equal(record.memory_record_stored, true);
assert.equal(record.operator_review_required_before_send, true);
assert.equal(record.agentmail_send_attempted, false);
assert.equal(record.agentmail_message_sent, false);
assert.equal(record.resend_called, false);
assert.equal(record.outbound_action_taken, false);
assert.equal(record.raw_email_stored, false);
assert.equal(record.normalized_email_stored, false);
assert.equal(record.email_hash_stored, false);
assert.equal(record.raw_session_text_stored, false);
assert.equal(record.draft_subject_stored, false);
assert.equal(record.draft_body_stored, false);
assertNoUnsafeValue(record);

const { fetchImpl, store } = createMockRedisFetch();
const stored = await storeHermesEmailActionStatus(
  {
    provider_conversation_id: "conv_email_status_test_001",
    communicationsResult,
    memoryOperatorResult: {
      memory_record_stored: true,
    },
  },
  { env: envOpen, fetchImpl, now: "2026-06-21T12:01:00.000Z" },
);
assert.equal(stored.email_action_status_store_attempted, true);
assert.equal(stored.email_action_status_stored, true);
assert.equal(stored.email_action_status, "stored");
assert.equal(stored.action_count, 3);
assert.equal(stored.draft_count, 3);
assert.equal(stored.send_count, 0);
assert.equal(store.size, 1);
assertNoUnsafeValue([...store.values()]);

const found = await buildHermesEmailActionStatusLookup(
  { provider_conversation_id: "conv_email_status_test_001" },
  { env: envOpen, fetchImpl },
);
assert.equal(found.provider_conversation_id_valid, true);
assert.equal(found.email_action_status_checked, true);
assert.equal(found.email_action_status_available, true);
assert.equal(found.email_action_status, "draft_plan_created");
assert.equal(found.email_action_plan_created, true);
assert.equal(found.action_count, 3);
assert.equal(found.draft_count, 3);
assert.equal(found.send_count, 0);
assert.equal(found.agentmail_send_attempted, false);
assert.equal(found.agentmail_message_sent, false);
assert.equal(found.outbound_action_taken, false);
assertNoUnsafeValue(found);

const missing = await buildHermesEmailActionStatusLookup(
  { provider_conversation_id: "conv_missing_status_001" },
  { env: envOpen, fetchImpl },
);
assert.equal(missing.email_action_status_checked, true);
assert.equal(missing.email_action_status_available, false);
assert.equal(missing.email_action_status, "not_found");
assertNoUnsafeValue(missing);

const invalid = await buildHermesEmailActionStatusLookup(
  { provider_conversation_id: "bad id with spaces" },
  { env: envOpen, fetchImpl },
);
assert.equal(invalid.provider_conversation_id_valid, false);
assert.equal(invalid.email_action_status_checked, false);
assertNoUnsafeValue(invalid);

const disabled = await buildHermesEmailActionStatusLookup(
  { provider_conversation_id: "conv_email_status_test_001" },
  { env: {}, fetchImpl },
);
assert.equal(disabled.provider_conversation_id_valid, true);
assert.equal(disabled.email_action_status_checked, false);
assert.equal(disabled.email_action_status_available, false);
assert.equal(disabled.email_action_status, "status_store_disabled");
assertNoUnsafeValue(disabled);

const routeSource = await readFile("app/api/xagent/email-actions/status/route.ts", "utf8");
assert.match(routeSource, /buildHermesEmailActionStatusLookup/);
assert.equal(routeSource.includes("resend.emails.send"), false);
assert.equal(routeSource.includes("agentmail"), false);
assert.equal(routeSource.includes("recalled_memory_summary"), false);

console.log("Hermes email action status store T48.1 checks passed");
