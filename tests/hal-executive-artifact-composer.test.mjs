import assert from "node:assert/strict";
import {
  buildHalExecutiveArtifact,
  HAL_EXECUTIVE_ARTIFACT_COMPOSER_VERSION,
} from "../lib/xagent/halExecutiveArtifactComposer.mjs";
import { buildHermesEmailCommunicationPlan } from "../lib/xagent/hermesEmailCommunicationsOperator.mjs";
import { buildHalSessionArtifact } from "../lib/xagent/halOperatorStore.mjs";

const envOpen = {
  XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
  XAGENT_HAL_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
  XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
  XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
  XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
  XAGENT_AI_FUSION_CALENDLY_URL: "https://calendly.com/aifusionlabs",
};

const transcript = [
  { role: "user", content: "Hi Hal, this is Rob. I run AI Fusion Labs and need an executive report." },
  { role: "user", content: "Give me five next moves for the business and make it useful for a CEO founder follow-up email." },
  { role: "agent", content: "I can prepare that as a post-session brief and keep the execution boundary clear." },
  { role: "user", content: "Focus on revenue, sales pipeline, and what needs human approval before automation." },
];

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "visitor@example.com",
    "private google drive",
    "api_key",
    "bearer ",
    "custom_greeting",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const directArtifact = buildHalExecutiveArtifact(
  {
    transcript,
    emailInsights: {
      company: "AI Fusion Labs",
      focus: "revenue, sales pipeline, and human approval boundaries",
    },
  },
  { now: "2026-07-01T18:00:00.000Z" },
);

assert.equal(HAL_EXECUTIVE_ARTIFACT_COMPOSER_VERSION, "hal_executive_artifact_composer_v1");
assert.equal(directArtifact.artifact_requested, true);
assert.equal(directArtifact.artifact_type, "growth_plan");
assert.equal(directArtifact.artifact_label, "Five-Point Growth Plan");
assert.match(directArtifact.title, /Five-Point Growth Plan/);
assert.equal(directArtifact.sections.length >= 3, true);
assert.equal(directArtifact.next_moves.length, 5);
assert.equal(directArtifact.safety.external_action_claimed, false);
assert.equal(directArtifact.safety.human_review_required_before_execution, true);
assertNoUnsafeValue(directArtifact);

const halPlan = buildHermesEmailCommunicationPlan(
  {
    provider_conversation_id: "conv_hal_exec_artifact_001",
    transcript,
    memoryOperatorResult: {
      memory_record_stored: true,
      memory_record_id: "hxemr_artifact_001",
    },
  },
  {
    agentSlug: "hal",
    env: envOpen,
    now: "2026-07-01T18:00:00.000Z",
  },
);

assert.equal(halPlan.action_count, 3);
assert.equal(halPlan.executive_artifact.artifact_requested, true);
assert.equal(halPlan.executive_artifact.artifact_label, "Five-Point Growth Plan");
assert.equal(halPlan.email_insight_metadata.executive_artifact_requested, true);
assert.equal(halPlan.email_insight_metadata.executive_artifact_type, "growth_plan");

const userFollowup = halPlan.actions.find((action) => action.action_type === "email.user_followup");
const adminSummary = halPlan.actions.find((action) => action.action_type === "email.admin_summary");
const leadIntel = halPlan.actions.find((action) => action.action_type === "email.lead_intel");
assert.ok(userFollowup);
assert.ok(adminSummary);
assert.ok(leadIntel);
assert.match(userFollowup.body_text_preview, /Executive Artifact/);
assert.match(userFollowup.body_text_preview, /Five-Point Growth Plan/);
assert.match(userFollowup.body_text_preview, /Five Next Moves/);
assert.match(userFollowup.body_text_preview, /Execution Boundary/);
assert.match(userFollowup.body_html_preview, /Executive Artifact/);
assert.match(userFollowup.body_html_preview, /Five-Point Growth Plan/);
assert.match(userFollowup.body_html_preview, /Human Approval Boundary/);
assert.match(adminSummary.body_text_preview, /Executive Artifact/);
assert.match(leadIntel.body_text_preview, /Executive Artifact/);
assertNoUnsafeValue(halPlan);

const daniPlan = buildHermesEmailCommunicationPlan(
  {
    provider_conversation_id: "conv_dani_exec_artifact_guard_001",
    transcript,
    memoryOperatorResult: {
      memory_record_stored: true,
      memory_record_id: "hxemr_dani_guard_001",
    },
  },
  {
    agentSlug: "dani",
    env: {
      ...envOpen,
      XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
    },
    now: "2026-07-01T18:00:00.000Z",
  },
);

assert.equal(daniPlan.executive_artifact, null);
assert.equal(daniPlan.email_insight_metadata.executive_artifact_requested, false);

const halSessionArtifact = buildHalSessionArtifact(
  {
    provider_conversation_id: "conv_hal_artifact_001",
    transcript,
    memoryOperatorResult: {
      memory_record_stored: true,
      memory_record_id: "hxemr_artifact_001",
    },
    communicationsResult: halPlan,
    agentMailSendResult: {
      sent_count: 3,
      sent_action_types: ["email.user_followup", "email.admin_summary", "email.lead_intel"],
      action_claim_allowed: true,
    },
  },
  { now: "2026-07-01T18:00:00.000Z" },
);

assert.equal(halSessionArtifact.post_session_brief.executive_artifact.artifact_label, "Five-Point Growth Plan");
assert.equal(halSessionArtifact.post_session_brief.executive_artifact.next_moves.length, 5);
assert.equal(halSessionArtifact.post_session_brief.signals.includes("executive_artifact_signal"), true);
assert.match(halSessionArtifact.post_session_brief.tl_dr, /prepared a Five-Point Growth Plan/);
assertNoUnsafeValue(halSessionArtifact);

console.log("Hal executive artifact composer checks passed");
