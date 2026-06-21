import { createHash } from "crypto";
import { DANI_AGENT_SLUG, DANI_TENANT_ID } from "./sessionIdentity.mjs";

const ADAPTER_VERSION = "t47_agentmail_adapter_readiness_v1";
const ENABLED_ENV = "XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH";
const ADDRESS_ENV = "XAGENT_DANI_AGENTMAIL_ADDRESS";
const API_KEY_ENV = "AGENTMAIL_API_KEY";
const EXPECTED_DANI_ADDRESS = "danixagent@agentmail.to";

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

function readGateConfig(overrides = {}) {
  return {
    enabled: env(ENABLED_ENV, overrides),
    daniPilotEnabled: env(DANI_PILOT_ENV, overrides),
    killSwitch: env(KILL_SWITCH_ENV, overrides),
  };
}

export function areAgentMailAdapterGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
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

export function readAgentMailAdapterConfig(overrides = {}) {
  const address = normalizeAgentMailAddress(env(ADDRESS_ENV, overrides));
  return {
    gatesOpen: areAgentMailAdapterGatesOpen(overrides),
    inboxAddress: address,
    inboxAddressConfigured: Boolean(address),
    inboxAddressMatchesDani: address === EXPECTED_DANI_ADDRESS,
    apiKeyPresent: Boolean(env(API_KEY_ENV, overrides)),
  };
}

export function buildAgentMailAdapterReadiness(options = {}) {
  const envSource = options.env ?? process.env;
  const config = readAgentMailAdapterConfig(envSource);
  return {
    adapter_version: ADAPTER_VERSION,
    checked_at: timestamp(options.now),
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    agentmail_adapter_code_present: true,
    agentmail_adapter_env_gates_open: config.gatesOpen,
    agentmail_inbox_address_configured: config.inboxAddressConfigured,
    agentmail_inbox_address: config.inboxAddress || null,
    expected_dani_agentmail_address: EXPECTED_DANI_ADDRESS,
    agentmail_inbox_matches_dani: config.inboxAddressMatchesDani,
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
      DANI_PILOT_ENV,
      KILL_SWITCH_ENV,
      ADDRESS_ENV,
      API_KEY_ENV,
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
} = {}) {
  const draftAction = assertDraftAction(action);
  const conversationId = String(provider_conversation_id ?? "").trim();
  if (!conversationId) {
    throw new Error("provider_conversation_id is required");
  }
  const normalizedInbox = normalizeAgentMailAddress(inboxAddress);
  if (!normalizedInbox) {
    throw new Error("AgentMail inbox address is required");
  }

  const clientId = `xagent:${DANI_TENANT_ID}:${DANI_AGENT_SLUG}:${conversationId}:${draftAction.action_type}`;
  return {
    adapter_version: ADAPTER_VERSION,
    artifact_purpose: "xagent_agentmail_send_payload_preview",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
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
export const DANI_AGENTMAIL_ADDRESS = EXPECTED_DANI_ADDRESS;
