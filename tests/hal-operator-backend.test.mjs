import assert from "node:assert/strict";
import {
  storeConversationEmailMappingForStart,
  storeEmailMemoryFromConversationTranscript,
} from "../lib/xagent/emailMemoryStore.mjs";
import {
  buildHalMeetingPrepBrief,
  buildHalOperatorDashboardSnapshot,
  storeHalMeetingPrepBrief,
  storeHalOperatorSessionArtifacts,
} from "../lib/xagent/halOperatorStore.mjs";

const envOpen = {
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_OUTBOUND_CONTACT_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_IDENTITY_SALT: "hal-operator-unit-test-salt",
  UPSTASH_REDIS_REST_URL: "https://hal-operator-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "hal-operator-unit-test-token",
};

function createMockFetch() {
  const redisStore = new Map();
  const fetchImpl = async (url, init = {}) => {
    assert.equal(url, "https://hal-operator-upstash.invalid/pipeline");
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
  };
  return { fetchImpl, redisStore };
}

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "visitor@example.com",
    "raw secret",
    "hal-operator-unit-test-token",
    "hal-operator-unit-test-salt",
    "private google drive",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const { fetchImpl, redisStore } = createMockFetch();
const options = {
  agentSlug: "hal",
  env: envOpen,
  fetchImpl,
  now: new Date("2026-07-01T18:00:00.000Z"),
};

await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "visitor@example.com", display_name: "Rob" },
    session_id: "xagent_session_hal_operator_001",
    provider_conversation_id: "conv_hal_operator_001",
    started_at: Date.parse("2026-07-01T17:55:00.000Z"),
  },
  options,
);

const transcript = [
  { role: "user", content: "Hal, remember that I care about executive autopilot boundaries and a meeting brief." },
  { role: "agent", content: "I can prepare a briefing and make the handoff boundary clear." },
  { role: "user", content: "Please prepare the follow-up email but do not claim anything was sent until there is a receipt." },
];

const memoryResult = await storeEmailMemoryFromConversationTranscript(
  {
    provider_conversation_id: "conv_hal_operator_001",
    transcript,
  },
  options,
);

const storeResult = await storeHalOperatorSessionArtifacts(
  {
    agentSlug: "hal",
    provider_conversation_id: "conv_hal_operator_001",
    transcript,
    memoryOperatorResult: memoryResult,
    communicationsResult: {
      hermes_email_actions_planned: true,
      hermes_email_actions_status: "draft_plan_created",
      hermes_email_actions_mode: "draft_only",
      hermes_email_actions_provider: "agentmail",
      action_count: 2,
      draft_count: 2,
      send_count: 0,
      operator_review_required_before_send: true,
      actions: [
        {
          action_id: "hxemail_user_followup",
          action_type: "email.user_followup",
          subject_preview: "Hal executive-autopilot follow-up",
          provider_candidate: "agentmail",
        },
        {
          action_id: "hxemail_admin_summary",
          action_type: "email.admin_summary",
          subject_preview: "Hal admin brief",
          provider_candidate: "agentmail",
        },
      ],
    },
    agentMailSendResult: {
      sent_count: 0,
      sent_action_types: [],
      action_claim_allowed: false,
    },
    emailActionStatusResult: {
      email_action_status_stored: true,
      email_action_status: "stored",
    },
  },
  options,
);

assert.equal(storeResult.hal_operator_store_stored, true);
assert.equal(storeResult.hal_operator_pending_action_count, 2);
assert.equal(storeResult.hal_operator_receipt_count, 6);

const dashboard = await buildHalOperatorDashboardSnapshot({ ...options, limit: 10 });
assert.equal(dashboard.status, "operator_store_ready");
assert.equal(dashboard.metrics.recent_session_count, 1);
assert.equal(dashboard.metrics.memory_write_count, 1);
assert.equal(dashboard.metrics.pending_action_count, 2);
assert.equal(dashboard.metrics.sent_email_count, 0);
assert.equal(dashboard.recent_sessions[0].brief.signals.includes("approval_boundary_signal"), true);
assert.equal(dashboard.recent_sessions[0].brief.signals.includes("executive_autopilot_signal"), true);
assert.equal(dashboard.receipts.some((receipt) => receipt.capability === "hermes.memory_write" && receipt.status === "completed"), true);
assert.equal(dashboard.receipts.some((receipt) => receipt.capability === "agentmail.post_session_send" && receipt.status === "queued_for_review"), true);
assertNoUnsafeValue(dashboard);

const prepPreview = buildHalMeetingPrepBrief(
  {
    title: "Portfolio founder check-in",
    objective: "Help decide what Hal can safely automate.",
    attendees: ["Rob", "visitor@example.com"],
    notes: "Private Google Drive files are not approved. Call me at 602-555-1212.",
  },
  options,
);
assert.equal(prepPreview.attendee_context.includes("[email redacted]"), true);
assert.equal(prepPreview.context_notes.includes("[phone redacted]"), true);
assertNoUnsafeValue(prepPreview);

const storedPrep = await storeHalMeetingPrepBrief(
  {
    title: "Board prep",
    objective: "Summarize decisions and handoff boundaries.",
    attendees: ["Hal operator"],
    persist: true,
  },
  options,
);
assert.equal(storedPrep.stored, true);
const dashboardWithPrep = await buildHalOperatorDashboardSnapshot(options);
assert.equal(dashboardWithPrep.prep_briefs.length, 1);
assert.equal([...redisStore.keys()].some((key) => key.includes(":hal:operator:")), true);

const disabled = await buildHalOperatorDashboardSnapshot({
  ...options,
  env: {
    ...envOpen,
    XAGENT_HAL_OPERATOR_KILL_SWITCH: "true",
  },
});
assert.equal(disabled.status, "operator_store_disabled");

console.log("Hal operator backend checks passed");
