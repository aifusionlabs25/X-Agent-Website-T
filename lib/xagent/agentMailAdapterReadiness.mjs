import { createHash } from "crypto";
import { getXAgentProfile, resolveXAgentSlug } from "./agentProfiles.mjs";
import { DANI_AGENT_SLUG } from "./sessionIdentity.mjs";

const ADAPTER_VERSION = "t47_agentmail_adapter_readiness_v1";
const ENABLED_ENV = "XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH";

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function timestamp(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isNaN(value.valueOf()) ? new Date(0).toISOString() : value.toISOString();
}

function readGateConfig(overrides = {}, options = {}) {
  const profile = getXAgentProfile(options.agentSlug);
  return {
    enabled: env(ENABLED_ENV, overrides),
    agentPilotEnabled: env(profile.agentMailAdapterPilotEnv, overrides),
    killSwitch: env(KILL_SWITCH_ENV, overrides),
  };
}

export function areAgentMailAdapterGatesOpen(overrides = {}, options = {}) {
  const gates = readGateConfig(overrides, options);
  return (
    gates.enabled === "true"
    && gates.agentPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function normalizeAgentMailAddress(address) {
  const value = String(address ?? "").trim().toLowerCase();
  if (!value) return "";
  if (!/^[a-z0-9][a-z0-9._-]{1,63}@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    throw new Error("AgentMail inbox address must be a valid email address");
  }
  return value;
}

export function readAgentMailAdapterConfig(overrides = {}, options = {}) {
  const profile = getXAgentProfile(options.agentSlug);
  const address = normalizeAgentMailAddress(env(profile.agentMailAddressEnv, overrides));
  return {
    tenantId: profile.tenantId,
    agentSlug: profile.agentSlug,
    gatesOpen: areAgentMailAdapterGatesOpen(overrides, options),
    inboxAddress: address,
    inboxAddressConfigured: Boolean(address),
    inboxAddressMatchesAgent: address === profile.expectedAgentMailAddress,
    inboxAddressMatchesDani: profile.agentSlug === DANI_AGENT_SLUG && address === profile.expectedAgentMailAddress,
    apiKeyPresent: Boolean(env(profile.agentMailApiKeyEnv, overrides)),
    expectedAgentMailAddress: profile.expectedAgentMailAddress,
    addressEnv: profile.agentMailAddressEnv,
    apiKeyEnv: profile.agentMailApiKeyEnv,
    pilotEnv: profile.agentMailAdapterPilotEnv,
  };
}

export function buildAgentMailAdapterReadiness(options = {}) {
  const envSource = options.env ?? process.env;
  const agentSlug = resolveXAgentSlug(options.agentSlug);
  const profile = getXAgentProfile(agentSlug);
  const config = readAgentMailAdapterConfig(envSource, { agentSlug });
  return {
    adapter_version: ADAPTER_VERSION,
    checked_at: timestamp(options.now),
    tenant_id: profile.tenantId,
    agent_slug: profile.agentSlug,
    agentmail_adapter_code_present: true,
    agentmail_adapter_env_gates_open: config.gatesOpen,
    agentmail_inbox_address_configured: config.inboxAddressConfigured,
    agentmail_inbox_address: config.inboxAddress || null,
    expected_agentmail_address: profile.expectedAgentMailAddress,
    expected_dani_agentmail_address: getXAgentProfile(DANI_AGENT_SLUG).expectedAgentMailAddress,
    agentmail_inbox_matches_dani: config.inboxAddressMatchesDani,
    agentmail_inbox_matches_agent: config.inboxAddressMatchesAgent,
    agentmail_api_key_present: config.apiKeyPresent,
    agentmail_api_key_value_included: false,
    agentmail_sdk_installed: false,
    agentmail_sdk_required_for_t47: false,
    agentmail_live_calls_enabled: false,
    agentmail_inbox_created_by_code: false,
    agentmail_send_attempted: false,
    agentmail_message_sent: false,
    resend_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
    required_env: [
      ENABLED_ENV,
      profile.agentMailAdapterPilotEnv,
      KILL_SWITCH_ENV,
      profile.agentMailAddressEnv,
      profile.agentMailApiKeyEnv,
    ],
  };
}

function assertDraftAction(action) {
  if (!action || typeof action !== "object") {
    throw new Error("draft action is required");
  }
  if (typeof action.action_type !== "string" || !action.action_type.startsWith("email.")) {
    throw new Error("draft action must be an email action");
  }
  if (action.draft_created !== true || action.send_attempted !== false) {
    throw new Error("AgentMail preview requires an unsent draft action");
  }
  return action;
}

export function buildAgentMailSendPayloadPreview({
  action,
  provider_conversation_id,
  inboxAddress,
  agentSlug = DANI_AGENT_SLUG,
} = {}) {
  const profile = getXAgentProfile(agentSlug);
  const draftAction = assertDraftAction(action);
  const conversationId = String(provider_conversation_id ?? "").trim();
  if (!conversationId) {
    throw new Error("provider_conversation_id is required");
  }
  const normalizedInbox = normalizeAgentMailAddress(inboxAddress);
  if (!normalizedInbox) {
    throw new Error("AgentMail inbox address is required");
  }

  const clientId = `xagent:${profile.tenantId}:${profile.agentSlug}:${conversationId}:${draftAction.action_type}`;
  return {
    adapter_version: ADAPTER_VERSION,
    artifact_purpose: "xagent_agentmail_send_payload_preview",
    tenant_id: profile.tenantId,
    agent_slug: profile.agentSlug,
    provider_conversation_id: conversationId,
    agentmail_method_preview: "client.inboxes.messages.send",
    agentmail_inbox_address: normalizedInbox,
    agentmail_client_id: clientId,
    agentmail_client_id_hash: sha256(clientId),
    action_id: draftAction.action_id,
    action_type: draftAction.action_type,
    to_policy: draftAction.recipient_policy,
    actual_to_included: false,
    subject_preview: draftAction.subject_preview,
    text_preview: draftAction.body_text_preview,
    html_included: false,
    attachments_included: false,
    api_key_included: false,
    live_agentmail_called: false,
    agentmail_send_attempted: false,
    agentmail_message_sent: false,
    outbound_action_taken: false,
    action_claim_allowed: false,
    operator_review_required_before_send: true,
  };
}

export const AGENTMAIL_ADAPTER_READINESS_VERSION = ADAPTER_VERSION;
export const DANI_AGENTMAIL_ADDRESS = getXAgentProfile(DANI_AGENT_SLUG).expectedAgentMailAddress;
export const HAL_AGENTMAIL_ADDRESS = getXAgentProfile("hal").expectedAgentMailAddress;
