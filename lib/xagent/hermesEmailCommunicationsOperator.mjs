import { createHash } from "crypto";
import { summarizeTranscriptForMemory } from "./emailMemoryStore.mjs";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const OPERATOR_VERSION = "t46_hermes_email_communications_operator_v1";
const ENABLED_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH";
const MODE_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_MODE";
const PROVIDER_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER";
const DRAFT_ONLY_MODE = "draft_only";
const SEND_MODE = "send";
const PROVIDER_NONE = "none";
const PROVIDER_RESEND = "resend";
const PROVIDER_AGENTMAIL = "agentmail";

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function nowIso(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isNaN(value.valueOf()) ? new Date(0).toISOString() : value.toISOString();
}

function truncate(value, maxLength) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function readGateConfig(overrides = {}) {
  return {
    enabled: env(ENABLED_ENV, overrides),
    daniPilotEnabled: env(DANI_PILOT_ENV, overrides),
    killSwitch: env(KILL_SWITCH_ENV, overrides),
  };
}

export function areHermesEmailActionGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function readHermesEmailActionMode(overrides = {}) {
  const mode = (env(MODE_ENV, overrides) || DRAFT_ONLY_MODE).toLowerCase();
  if (mode !== DRAFT_ONLY_MODE && mode !== SEND_MODE) {
    throw new Error(`${MODE_ENV} must be draft_only or send`);
  }
  return mode;
}

export function readHermesEmailActionProvider(overrides = {}) {
  const provider = (env(PROVIDER_ENV, overrides) || PROVIDER_NONE).toLowerCase();
  if (![PROVIDER_NONE, PROVIDER_RESEND, PROVIDER_AGENTMAIL].includes(provider)) {
    throw new Error(`${PROVIDER_ENV} must be none, resend, or agentmail`);
  }
  return provider;
}

function redactEmailLikeText(content) {
  return String(content ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:[a-z0-9]\s*[- ]\s*){2,}[a-z0-9]?\s*(?:at|@)\s*(?:gmail|yahoo|outlook|hotmail)(?:\s*dot\s*|\.)\s*[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b[a-z0-9._%+-]+\s+(?:at)\s+[a-z0-9.-]+(?:\s+dot\s+|\.)[a-z]{2,}\b/gi, "[email redacted]");
}

function collectTranscriptSignals(transcript) {
  const normalized = normalizeTranscriptTurns(transcript);
  const safeUserTurns = normalized
    .filter((turn) => turn.role === "user")
    .map((turn) => redactEmailLikeText(turn.content))
    .filter((content) => content.length >= 12);
  return {
    normalized_turn_count: normalized.length,
    user_turn_count: safeUserTurns.length,
    safe_user_signal_preview: truncate(safeUserTurns.slice(0, 4).join(" "), 420),
  };
}

function buildActionId(providerConversationId, actionType) {
  return `hxemail_${sha256(`${OPERATOR_VERSION}:${providerConversationId}:${actionType}`).slice(0, 16)}`;
}

function buildDraftAction({
  actionType,
  providerConversationId,
  subject,
  bodyText,
  recipientPolicy,
  providerCandidate,
}) {
  return {
    action_id: buildActionId(providerConversationId, actionType),
    action_type: actionType,
    status: "draft_ready_send_blocked",
    draft_created: true,
    send_attempted: false,
    send_completed: false,
    provider_candidate: providerCandidate,
    recipient_policy: recipientPolicy,
    subject_preview: truncate(subject, 140),
    body_text_preview: truncate(redactEmailLikeText(bodyText), 900),
    operator_review_required_before_send: true,
    action_claim_allowed: false,
    send_blocked_reason: "live_email_send_not_enabled",
  };
}

function preferredProvider(provider) {
  if (provider === PROVIDER_AGENTMAIL) return PROVIDER_AGENTMAIL;
  if (provider === PROVIDER_RESEND) return PROVIDER_RESEND;
  return PROVIDER_NONE;
}

export function buildHermesEmailCommunicationPlan({
  provider_conversation_id,
  transcript,
  transcriptMetadata,
  memoryOperatorResult,
} = {}, options = {}) {
  const providerConversationId = typeof provider_conversation_id === "string"
    ? provider_conversation_id.trim()
    : "";
  if (!providerConversationId) {
    throw new Error("provider_conversation_id is required");
  }

  const envSource = options.env ?? process.env;
  const provider = readHermesEmailActionProvider(envSource);
  const providerCandidate = preferredProvider(provider);
  const transcriptSignals = collectTranscriptSignals(transcript);
  const memorySummary = summarizeTranscriptForMemory(transcript);
  const safeSummary = redactEmailLikeText(memorySummary.summary);
  const createdAt = nowIso(options.now);
  const adminRecipientPolicy = options.adminRecipientConfigured
    ? "configured_internal_recipient_redacted"
    : "internal_recipient_not_configured";
  const userRecipientPolicy = "raw_user_email_not_available_to_email_action_layer";

  const userFollowup = buildDraftAction({
    actionType: "email.user_followup",
    providerConversationId,
    providerCandidate,
    recipientPolicy: userRecipientPolicy,
    subject: "Thanks for talking with Dani",
    bodyText: [
      "Hi there,",
      "",
      "Thanks for spending time with Dani. Here is the safe recap prepared from the session:",
      safeSummary,
      "",
      "A team member can follow up with next steps after the request is reviewed.",
    ].join("\n"),
  });

  const adminSummary = buildDraftAction({
    actionType: "email.admin_summary",
    providerConversationId,
    providerCandidate,
    recipientPolicy: adminRecipientPolicy,
    subject: "New Dani session summary",
    bodyText: [
      "A Dani session completed and produced a memory-safe summary.",
      `Conversation: ${providerConversationId}`,
      `Summary: ${safeSummary}`,
      `Transcript turns retained for planning: ${transcriptSignals.normalized_turn_count}`,
    ].join("\n"),
  });

  const leadIntel = buildDraftAction({
    actionType: "email.lead_intel",
    providerConversationId,
    providerCandidate,
    recipientPolicy: adminRecipientPolicy,
    subject: "Dani lead-intel draft",
    bodyText: [
      "Lead-intel draft for operator review.",
      `Primary safe signals: ${transcriptSignals.safe_user_signal_preview || "No durable safe user signals detected."}`,
      `Memory summary: ${safeSummary}`,
      "Recommended next step: review the session before making outbound claims or sending follow-up.",
    ].join("\n"),
  });

  return {
    operator_version: OPERATOR_VERSION,
    artifact_purpose: "xagent_hermes_email_communications_plan",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    created_at: createdAt,
    communication_plan_id: `hxecp_${sha256(`${OPERATOR_VERSION}:${providerConversationId}:${createdAt}`).slice(0, 16)}`,
    mode: DRAFT_ONLY_MODE,
    configured_provider: provider,
    provider_recommendation: {
      first_controlled_live_send: PROVIDER_RESEND,
      replyable_agent_inbox: PROVIDER_AGENTMAIL,
      suggested_agentmail_username: "dani-xagent",
      suggested_agentmail_display_name: "Dani X Agent SDR",
    },
    transcript_metadata: transcriptMetadata ?? {},
    transcript_signal_metadata: transcriptSignals,
    memory_record_id: memoryOperatorResult?.memory_record_id ?? null,
    memory_record_stored: Boolean(memoryOperatorResult?.memory_record_stored),
    action_count: 3,
    draft_count: 3,
    send_count: 0,
    actions: [userFollowup, adminSummary, leadIntel],
    policies: {
      post_session_only: true,
      live_turn_loop_dependency: false,
      outbound_action_allowed: false,
      outbound_completion_claim_allowed_without_tool_confirmation: false,
      raw_email_available_to_email_action_layer: false,
      raw_transcript_stored_in_plan: false,
      operator_review_required_before_send: true,
    },
    agentmail_inbox_created: false,
    resend_called: false,
    agentmail_called: false,
    live_agentmail_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
  };
}

export async function runHermesEmailCommunicationsOperator(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  if (!areHermesEmailActionGatesOpen(envSource)) {
    return {
      hermes_email_actions_attempted: false,
      hermes_email_actions_planned: false,
      hermes_email_actions_status: "email_actions_disabled",
      hermes_email_actions_mode: readHermesEmailActionMode(envSource),
      hermes_email_actions_provider: readHermesEmailActionProvider(envSource),
      action_count: 0,
      draft_count: 0,
      send_count: 0,
      agentmail_inbox_created: false,
      resend_called: false,
      agentmail_called: false,
      live_agentmail_called: false,
      live_hermes_called: false,
      openai_called: false,
      ollama_generate_called: false,
      outbound_action_taken: false,
      production_database_mutated: false,
    };
  }

  const mode = readHermesEmailActionMode(envSource);
  const provider = readHermesEmailActionProvider(envSource);
  if (mode === SEND_MODE) {
    return {
      hermes_email_actions_attempted: true,
      hermes_email_actions_planned: false,
      hermes_email_actions_status: "send_mode_blocked_until_provider_adapter_approved",
      hermes_email_actions_mode: mode,
      hermes_email_actions_provider: provider,
      action_count: 0,
      draft_count: 0,
      send_count: 0,
      agentmail_inbox_created: false,
      resend_called: false,
      agentmail_called: false,
      live_agentmail_called: false,
      live_hermes_called: false,
      openai_called: false,
      ollama_generate_called: false,
      outbound_action_taken: false,
      production_database_mutated: false,
    };
  }

  const plan = buildHermesEmailCommunicationPlan(input, options);
  return {
    hermes_email_actions_attempted: true,
    hermes_email_actions_planned: true,
    hermes_email_actions_status: "draft_plan_created",
    hermes_email_actions_mode: mode,
    hermes_email_actions_provider: provider,
    communication_plan_id: plan.communication_plan_id,
    action_count: plan.action_count,
    draft_count: plan.draft_count,
    send_count: plan.send_count,
    provider_recommendation: plan.provider_recommendation,
    actions: plan.actions,
    action_claim_allowed: false,
    operator_review_required_before_send: true,
    agentmail_inbox_created: false,
    resend_called: false,
    agentmail_called: false,
    live_agentmail_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
  };
}

export const HERMES_EMAIL_COMMUNICATIONS_OPERATOR_VERSION = OPERATOR_VERSION;
