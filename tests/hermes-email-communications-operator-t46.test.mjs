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
    content: "Hi Dani, this is Rob. I spoke with you before and run Vicks Law Firm.",
  },
  {
    role: "user",
    content: "Please send the follow-up email with a meeting invitation for Tuesday at 10 a.m.",
  },
  {
    role: "user",
    content: "The X Agent should help with legal intake, scheduling, and follow-up.",
  },
  {
    role: "agent",
    content: "I have notes from our earlier chats and can capture that request for the team.",
  },
  {
    role: "user",
    content: "My email is rob@example.com and I want that meeting invite sent.",
  },
];

const draftEnv = {
  XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
  XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
  XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
  XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
  XAGENT_AI_FUSION_CALENDLY_URL: "https://calendly.com/aifusionlabs",
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
  assert.deepEqual(new Set(result.actions.map((action) => action.subject_preview)).size, 3);
  assert.deepEqual(new Set(result.actions.map((action) => action.body_text_preview)).size, 3);
  const userFollowup = result.actions.find((action) => action.action_type === "email.user_followup");
  const adminSummary = result.actions.find((action) => action.action_type === "email.admin_summary");
  const leadIntel = result.actions.find((action) => action.action_type === "email.lead_intel");
  assert.match(userFollowup.body_text_preview, /Hi Rob/i);
  assert.match(userFollowup.body_text_preview, /\n\nDiscussion Summary\n/);
  assert.match(userFollowup.body_text_preview, /Vicks Law Firm/);
  assert.match(userFollowup.body_text_preview, /Tuesday at 10 a\.m\./i);
  assert.match(userFollowup.body_text_preview, /Requested meeting time: Tuesday at 10 a\.m\./i);
  assert.match(userFollowup.body_text_preview, /legal intake/i);
  assert.match(userFollowup.body_text_preview, /\n\nSchedule \/ Confirmation\n/);
  assert.match(userFollowup.body_text_preview, /You mentioned this meeting time: Tuesday at 10 a\.m\./i);
  assert.match(userFollowup.body_text_preview, /closest available 30-minute Dani Demo Call/i);
  assert.match(userFollowup.body_text_preview, /30-minute Dani Demo Call/i);
  assert.match(userFollowup.body_text_preview, /https:\/\/calendly\.com\/aifusionlabs/);
  assert.match(userFollowup.body_text_preview, /will not claim the meeting is scheduled until the booking is confirmed/i);
  assert.match(userFollowup.body_text_preview, /\n\nBest regards,\nDani/);
  assert.equal(userFollowup.body_text_preview.includes("Hi Rob, Thanks"), false);
  assert.match(adminSummary.body_text_preview, /^New Dani Intake\n\nConversation ID: conv_email_actions_draft_001/m);
  assert.match(adminSummary.body_text_preview, /Conversation ID: conv_email_actions_draft_001/);
  assert.match(adminSummary.body_text_preview, /\n\nContact \/ Context\n/);
  assert.match(adminSummary.body_text_preview, /\n\nRequest Details\n/);
  assert.match(adminSummary.body_text_preview, /Calendly CTA included: yes/);
  assert.match(adminSummary.body_text_preview, /Requested meeting time: Tuesday at 10 a\.m\./i);
  assert.match(adminSummary.body_text_preview, /Visitor-facing CTA references requested time: yes/);
  assert.match(adminSummary.body_text_preview, /visitor requested a meeting\/demo/);
  assert.match(adminSummary.body_text_preview, /\n\nScheduling \/ Follow-up\n/);
  assert.match(adminSummary.body_text_preview, /Do not tell the visitor a meeting is scheduled until Calendly or a human confirms the booking/i);
  assert.match(adminSummary.body_text_preview, /\n\nOperator Action Plan\n/);
  assert.match(leadIntel.subject_preview, /\[PROSPECT SCORE 10\/10\]/);
  assert.match(leadIntel.body_text_preview, /^Dani Lead Intelligence Report\n\nProspect Score: 10\/10/m);
  assert.match(leadIntel.body_text_preview, /Lead temperature: returning warm lead/i);
  assert.match(leadIntel.body_text_preview, /\n\nOpportunity Signals\n/);
  assert.match(leadIntel.body_text_preview, /Scheduling intent: Tuesday at 10 a\.m\./i);
  assert.match(leadIntel.body_text_preview, /Calendly CTA included: yes/);
  assert.match(leadIntel.body_text_preview, /\n\nRecommended Next Steps\n/);
  assert.match(leadIntel.body_text_preview, /Prioritize the requested Tuesday at 10 a\.m\. meeting window/i);
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
  assertNoOldTranscriptDumpPhrasing(result);
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
  assert.deepEqual(new Set(plan.actions.map((action) => action.subject_preview)).size, 3);
  assert.deepEqual(new Set(plan.actions.map((action) => action.body_text_preview)).size, 3);
  assert.equal(plan.email_insight_metadata.returning_visitor_signal, true);
  assert.equal(plan.email_insight_metadata.company_detected, true);
  assert.equal(plan.email_insight_metadata.meeting_time_detected, true);
  assert.equal(plan.email_insight_metadata.focus_detected, true);
  assert.equal(plan.email_insight_metadata.meeting_request_detected, true);
  assert.equal(plan.email_insight_metadata.calendly_cta_included, true);
  assert.equal(plan.email_insight_metadata.calendly_meeting_label, "Dani Demo Call");
  assert.equal(plan.email_insight_metadata.calendly_meeting_length, "30-minute");
  assert.equal(plan.email_insight_metadata.calendly_timezone, "Phoenix, AZ");
  assert.equal(plan.email_insight_metadata.lead_score, 10);
  assertNoOldTranscriptDumpPhrasing(plan);
  assertNoUnsafeValue(plan);
}

console.log("Hermes email communications operator T46 checks passed");
