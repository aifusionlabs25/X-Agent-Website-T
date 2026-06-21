import { createHash } from "crypto";
import {
  buildAgentMailSendPayloadPreview,
  readAgentMailAdapterConfig,
} from "./agentMailAdapterReadiness.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID } from "./sessionIdentity.mjs";

const ADAPTER_VERSION = "t48_agentmail_send_adapter_v1";
const ENABLED_ENV = "XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH";
const MODE_ENV = "XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE";
const PREVIEW_MODE = "preview";
const LIVE_MODE = "live";

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

export function areAgentMailSendAdapterGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function readAgentMailSendAdapterMode(overrides = {}) {
  const mode = (env(MODE_ENV, overrides) || PREVIEW_MODE).toLowerCase();
  if (mode !== PREVIEW_MODE && mode !== LIVE_MODE) {
    throw new Error(`${MODE_ENV} must be preview or live`);
  }
  return mode;
}

function normalizeRecipientEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("recipient email must be a valid email address");
  }
  return email;
}

export function buildAgentMailSendAdapterReadiness(options = {}) {
  const envSource = options.env ?? process.env;
  const agentMailConfig = readAgentMailAdapterConfig(envSource);
  const sendGatesOpen = areAgentMailSendAdapterGatesOpen(envSource);
  const mode = readAgentMailSendAdapterMode(envSource);
  return {
    adapter_version: ADAPTER_VERSION,
    checked_at: timestamp(options.now),
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    agentmail_send_adapter_code_present: true,
    agentmail_send_adapter_env_gates_open: sendGatesOpen,
    agentmail_send_adapter_mode: mode,
    agentmail_send_adapter_live_mode_requested: sendGatesOpen && mode === LIVE_MODE,
    agentmail_send_adapter_ready_for_t49_one_send_test:
      sendGatesOpen
      && mode === LIVE_MODE
      && agentMailConfig.gatesOpen
      && agentMailConfig.inboxAddressMatchesDani
      && agentMailConfig.apiKeyPresent,
    agentmail_action_ledger_code_present: true,
    agentmail_action_ledger_persistence_enabled: false,
    agentmail_live_calls_enabled: false,
    agentmail_send_attempted: false,
    agentmail_message_sent: false,
    agentmail_api_key_value_included: false,
    actual_recipient_included: false,
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
      MODE_ENV,
    ],
  };
}

export function buildAgentMailActionLedgerPreview({
  payloadPreview,
  recipientEmail,
  now,
} = {}) {
  if (!payloadPreview || typeof payloadPreview !== "object") {
    throw new Error("AgentMail payload preview is required");
  }
  const normalizedRecipient = normalizeRecipientEmail(recipientEmail);
  const recipientHash = normalizedRecipient ? sha256(normalizedRecipient) : null;
  const idempotencySeed = [
    ADAPTER_VERSION,
    payloadPreview.provider_conversation_id,
    payloadPreview.action_type,
    payloadPreview.agentmail_client_id_hash,
    recipientHash ?? "recipient_not_supplied",
  ].join(":");

  return {
    ledger_version: ADAPTER_VERSION,
    artifact_purpose: "xagent_agentmail_action_ledger_preview",
    created_at: timestamp(now),
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    ledger_id: `hxamledger_${sha256(idempotencySeed).slice(0, 16)}`,
    idempotency_key_hash: sha256(idempotencySeed),
    provider_conversation_id: payloadPreview.provider_conversation_id,
    action_id: payloadPreview.action_id,
    action_type: payloadPreview.action_type,
    recipient_supplied: Boolean(normalizedRecipient),
    recipient_hash_present: Boolean(recipientHash),
    raw_recipient_included: false,
    api_key_included: false,
    payload_text_included: false,
    send_status: "pending_operator_approval",
    send_attempted: false,
    send_completed: false,
    duplicate_send_prevention_ready: true,
    persistence_required_before_live_send: true,
    production_database_mutated: false,
    outbound_action_taken: false,
  };
}

export function prepareAgentMailControlledSend(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  const agentMailConfig = readAgentMailAdapterConfig(envSource);
  const sendGatesOpen = areAgentMailSendAdapterGatesOpen(envSource);
  const mode = readAgentMailSendAdapterMode(envSource);

  if (!sendGatesOpen) {
    return {
      adapter_version: ADAPTER_VERSION,
      agentmail_controlled_send_attempted: false,
      agentmail_controlled_send_prepared: false,
      agentmail_send_status: "send_adapter_disabled",
      agentmail_send_adapter_mode: mode,
      agentmail_live_calls_enabled: false,
      agentmail_send_attempted: false,
      agentmail_message_sent: false,
      outbound_action_taken: false,
      production_database_mutated: false,
    };
  }

  const payloadPreview = buildAgentMailSendPayloadPreview({
    action: input.action,
    provider_conversation_id: input.provider_conversation_id,
    inboxAddress: agentMailConfig.inboxAddress,
  });
  const ledgerPreview = buildAgentMailActionLedgerPreview({
    payloadPreview,
    recipientEmail: input.recipientEmail,
    now: options.now,
  });

  return {
    adapter_version: ADAPTER_VERSION,
    agentmail_controlled_send_attempted: true,
    agentmail_controlled_send_prepared: mode === PREVIEW_MODE,
    agentmail_send_status: mode === LIVE_MODE
      ? "live_send_blocked_until_t49_one_send_approval"
      : "preview_ready_live_send_blocked",
    agentmail_send_adapter_mode: mode,
    agentmail_send_adapter_live_mode_requested: mode === LIVE_MODE,
    agentmail_adapter_configured:
      agentMailConfig.gatesOpen
      && agentMailConfig.inboxAddressMatchesDani
      && agentMailConfig.apiKeyPresent,
    ledger_preview: ledgerPreview,
    payload_preview: {
      ...payloadPreview,
      text_preview: undefined,
    },
    subject_preview: payloadPreview.subject_preview,
    text_preview_present: Boolean(payloadPreview.text_preview),
    actual_recipient_included: false,
    api_key_included: false,
    live_agentmail_called: false,
    agentmail_send_attempted: false,
    agentmail_message_sent: false,
    action_claim_allowed: false,
    operator_review_required_before_send: true,
    outbound_action_taken: false,
    production_database_mutated: false,
  };
}

export const AGENTMAIL_SEND_ADAPTER_VERSION = ADAPTER_VERSION;
