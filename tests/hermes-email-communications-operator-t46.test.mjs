import assert from "node:assert/strict";
import {
  areHermesEmailActionGatesOpen,
  buildHermesEmailCommunicationPlan,
  HERMES_EMAIL_COMMUNICATIONS_OPERATOR_VERSION,
  readHermesEmailActionMode,
  readHermesEmailActionProvider,
  runHermesEmailCommunicationsOperator,
} from "../lib/xagent/hermesEmailCommunicationsOperator.mjs";

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
    content: "The agent should notify me within five minutes and maybe integrate with Clio later.",
  },
  {
    role: "user",
    content: "My email is rob@example.com and I want a technical call next Tuesday.",
  },
];

const draftEnv = {
  XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
  XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
  XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
  XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
};

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "rob@example.com",
    "rvics@gmail.com",
    "r-v-i-c-k-s",
    "gmail dot com",
    "unit-test-token",
    "bearer ",
    "api_key",
    "conversation_url",
    "custom_greeting",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

assert.equal(HERMES_EMAIL_COMMUNICATIONS_OPERATOR_VERSION, "t46_hermes_email_communications_operator_v1");
assert.equal(areHermesEmailActionGatesOpen(draftEnv), true);
assert.equal(areHermesEmailActionGatesOpen({
  XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true ",
  XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true ",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false ",
}), true);
assert.equal(readHermesEmailActionMode({}), "draft_only");
assert.equal(readHermesEmailActionMode({ XAGENT_HERMES_EMAIL_ACTIONS_MODE: "send " }), "send");
assert.equal(readHermesEmailActionProvider({}), "none");
assert.equal(readHermesEmailActionProvider({ XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail " }), "agentmail");

{
  const disabled = await runHermesEmailCommunicationsOperator(
    {
      provider_conversation_id: "conv_email_actions_disabled_001",
      transcript,
      transcriptMetadata: {},
      memoryOperatorResult: {},
    },
    { env: {} },
  );
  assert.equal(disabled.hermes_email_actions_attempted, false);
  assert.equal(disabled.hermes_email_actions_planned, false);
  assert.equal(disabled.hermes_email_actions_status, "email_actions_disabled");
  assert.equal(disabled.draft_count, 0);
  assert.equal(disabled.send_count, 0);
  assert.equal(disabled.resend_called, false);
  assert.equal(disabled.agentmail_called, false);
  assert.equal(disabled.outbound_action_taken, false);
  assertNoUnsafeValue(disabled);
}

{
  const result = await runHermesEmailCommunicationsOperator(
    {
      provider_conversation_id: "conv_email_actions_draft_001",
      transcript,
      transcriptMetadata: {
        source_turn_count: 4,
        retained_memory_turn_count: 4,
      },
      memoryOperatorResult: {
        memory_record_stored: true,
        memory_record_id: "hxemr_unit_test",
      },
    },
    { env: draftEnv, now: "2026-06-21T12:00:00.000Z" },
  );

  assert.equal(result.hermes_email_actions_attempted, true);
  assert.equal(result.hermes_email_actions_planned, true);
  assert.equal(result.hermes_email_actions_status, "draft_plan_created");
  assert.equal(result.hermes_email_actions_mode, "draft_only");
  assert.equal(result.hermes_email_actions_provider, "agentmail");
  assert.equal(result.action_count, 3);
  assert.equal(result.draft_count, 3);
  assert.equal(result.send_count, 0);
  assert.equal(result.provider_recommendation.replyable_agent_inbox, "agentmail");
  assert.equal(result.provider_recommendation.first_controlled_live_send, "resend");
  assert.equal(result.provider_recommendation.suggested_agentmail_username, "dani-xagent");
  assert.deepEqual(result.actions.map((action) => action.action_type), [
    "email.user_followup",
    "email.admin_summary",
    "email.lead_intel",
  ]);
  for (const action of result.actions) {
    assert.equal(action.draft_created, true);
    assert.equal(action.send_attempted, false);
    assert.equal(action.send_completed, false);
    assert.equal(action.action_claim_allowed, false);
    assert.equal(action.operator_review_required_before_send, true);
    assert.equal(action.send_blocked_reason, "live_email_send_not_enabled");
  }
  assert.equal(result.agentmail_inbox_created, false);
  assert.equal(result.resend_called, false);
  assert.equal(result.agentmail_called, false);
  assert.equal(result.live_agentmail_called, false);
  assert.equal(result.live_hermes_called, false);
  assert.equal(result.outbound_action_taken, false);
  assertNoUnsafeValue(result);
}

{
  const blockedSend = await runHermesEmailCommunicationsOperator(
    {
      provider_conversation_id: "conv_email_actions_send_blocked_001",
      transcript,
    },
    {
      env: {
        ...draftEnv,
        XAGENT_HERMES_EMAIL_ACTIONS_MODE: "send",
        XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "resend",
      },
    },
  );
  assert.equal(blockedSend.hermes_email_actions_attempted, true);
  assert.equal(blockedSend.hermes_email_actions_planned, false);
  assert.equal(blockedSend.hermes_email_actions_status, "send_mode_blocked_until_provider_adapter_approved");
  assert.equal(blockedSend.hermes_email_actions_mode, "send");
  assert.equal(blockedSend.hermes_email_actions_provider, "resend");
  assert.equal(blockedSend.send_count, 0);
  assert.equal(blockedSend.resend_called, false);
  assert.equal(blockedSend.outbound_action_taken, false);
  assertNoUnsafeValue(blockedSend);
}

{
  const plan = buildHermesEmailCommunicationPlan(
    {
      provider_conversation_id: "conv_email_actions_plan_001",
      transcript,
      transcriptMetadata: {},
      memoryOperatorResult: {
        memory_record_stored: true,
        memory_record_id: "hxemr_unit_test",
      },
    },
    { env: draftEnv, now: "2026-06-21T12:00:00.000Z", adminRecipientConfigured: true },
  );
  assert.equal(plan.operator_version, HERMES_EMAIL_COMMUNICATIONS_OPERATOR_VERSION);
  assert.equal(plan.communication_plan_id, "hxecp_7d2aeffee35bc708");
  assert.equal(plan.policies.post_session_only, true);
  assert.equal(plan.policies.outbound_action_allowed, false);
  assert.equal(plan.policies.raw_email_available_to_email_action_layer, false);
  assert.equal(plan.policies.operator_review_required_before_send, true);
  assert.equal(plan.agentmail_inbox_created, false);
  assert.equal(plan.resend_called, false);
  assert.equal(plan.agentmail_called, false);
  assert.equal(plan.outbound_action_taken, false);
  assertNoUnsafeValue(plan);
}

console.log("Hermes email communications operator T46 checks passed");
