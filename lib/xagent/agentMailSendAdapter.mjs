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
const ADMIN_RECIPIENT_ENV = "XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT";
const AGENTMAIL_API_BASE_URL_ENV = "AGENTMAIL_API_BASE_URL";
const AGENTMAIL_API_KEY_ENV = "AGENTMAIL_API_KEY";
const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";
const PREVIEW_MODE = "preview";
const LIVE_MODE = "live";
const DEFAULT_AGENTMAIL_API_BASE_URL = "https://api.agentmail.to";

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

function readAdminRecipient(overrides = {}) {
  const value = env(ADMIN_RECIPIENT_ENV, overrides);
  return value ? normalizeRecipientEmail(value) : "";
}

function readAgentMailApiConfig(overrides = {}) {
  const apiKey = env(AGENTMAIL_API_KEY_ENV, overrides);
  const apiBaseUrl = (env(AGENTMAIL_API_BASE_URL_ENV, overrides) || DEFAULT_AGENTMAIL_API_BASE_URL).replace(/\/$/, "");
  if (!apiKey) {
    throw new Error(`${AGENTMAIL_API_KEY_ENV} is required`);
  }
  return { apiKey, apiBaseUrl };
}

function readLedgerConfig(overrides = {}) {
  const upstashUrl = env(UPSTASH_URL_ENV, overrides);
  const upstashToken = env(UPSTASH_TOKEN_ENV, overrides);
  if (!upstashUrl) {
    throw new Error(`${UPSTASH_URL_ENV} is required for AgentMail send ledger`);
  }
  if (!upstashToken) {
    throw new Error(`${UPSTASH_TOKEN_ENV} is required for AgentMail send ledger`);
  }
  return {
    upstashUrl: upstashUrl.replace(/\/$/, ""),
    upstashToken,
  };
}

function sendLedgerKey(providerConversationId, actionType) {
  return `xagent:${DANI_TENANT_ID}:${DANI_AGENT_SLUG}:agentmail-send:${providerConversationId}:${actionType}`;
}

async function upstashCommand(command, { envSource, fetchImpl } = {}) {
  const config = readLedgerConfig(envSource);
  const response = await fetchImpl(`${config.upstashUrl}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
  });

  if (!response.ok) {
    const text = typeof response.text === "function" ? await response.text() : "";
    throw new Error(`Upstash Redis command failed: ${response.status} ${text}`.trim());
  }

  const payload = await response.json();
  const item = Array.isArray(payload) ? payload[0] : payload;
  if (item?.error) {
    throw new Error(`Upstash Redis command error: ${item.error}`);
  }
  return item?.result ?? null;
}

async function readSendLedger(providerConversationId, actionType, { envSource, fetchImpl } = {}) {
  const value = await upstashCommand(["GET", sendLedgerKey(providerConversationId, actionType)], {
    envSource,
    fetchImpl,
  });
  if (!value) return null;
  if (typeof value === "object") return value;
  return JSON.parse(value);
}

async function writeSendLedger(providerConversationId, actionType, value, { envSource, fetchImpl } = {}) {
  return upstashCommand(
    ["SET", sendLedgerKey(providerConversationId, actionType), JSON.stringify(value)],
    { envSource, fetchImpl },
  );
}

export function buildAgentMailSendAdapterReadiness(options = {}) {
  const envSource = options.env ?? process.env;
  const agentMailConfig = readAgentMailAdapterConfig(envSource);
  const sendGatesOpen = areAgentMailSendAdapterGatesOpen(envSource);
  const mode = readAgentMailSendAdapterMode(envSource);
  const ledgerConfigured = Boolean(env(UPSTASH_URL_ENV, envSource) && env(UPSTASH_TOKEN_ENV, envSource));
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
      && agentMailConfig.apiKeyPresent
      && ledgerConfigured,
    agentmail_action_ledger_code_present: true,
    agentmail_action_ledger_persistence_enabled: ledgerConfigured,
    agentmail_admin_recipient_configured: Boolean(readAdminRecipient(envSource)),
    agentmail_live_calls_enabled:
      sendGatesOpen
      && mode === LIVE_MODE
      && agentMailConfig.gatesOpen
      && agentMailConfig.inboxAddressMatchesDani
      && agentMailConfig.apiKeyPresent
      && ledgerConfigured,
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

function textFromAction(action) {
  return String(action?.body_text_preview ?? "").trim();
}

function subjectFromAction(action) {
  return String(action?.subject_preview ?? "Dani X Agent follow-up").trim().slice(0, 180);
}

function recipientForAction(action, input = {}, envSource = process.env) {
  const actionType = String(action?.action_type ?? "");
  if (actionType === "email.user_followup") {
    return input.outboundContactEmail ? normalizeRecipientEmail(input.outboundContactEmail) : "";
  }
  if (actionType === "email.admin_summary" || actionType === "email.lead_intel") {
    return readAdminRecipient(envSource);
  }
  return "";
}

function safeSendResultBase(action) {
  return {
    action_type: String(action?.action_type ?? "unknown"),
    agentmail_send_attempted: false,
    agentmail_message_sent: false,
    send_status: "not_attempted",
    message_id_present: false,
    thread_id_present: false,
    actual_recipient_included: false,
    api_key_included: false,
    payload_text_included: false,
    outbound_action_taken: false,
  };
}

async function sendAgentMailMessage({
  inboxAddress,
  recipientEmail,
  subject,
  text,
  providerConversationId,
  actionType,
  envSource,
  fetchImpl,
} = {}) {
  const { apiKey, apiBaseUrl } = readAgentMailApiConfig(envSource);
  const response = await fetchImpl(
    `${apiBaseUrl}/v0/inboxes/${encodeURIComponent(inboxAddress)}/messages/send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject,
        text,
        labels: [
          "xagent",
          "dani",
          "post-session",
          actionType.replace(/^email\./, "").replace(/_/g, "-"),
        ],
        headers: {
          "X-XAgent-Conversation-ID": providerConversationId,
          "X-XAgent-Action-Type": actionType,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = typeof response.text === "function" ? await response.text() : "";
    throw new Error(`AgentMail send failed: ${response.status} ${detail}`.trim());
  }

  return response.json();
}

export async function runAgentMailPostSessionSends(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const agentMailConfig = readAgentMailAdapterConfig(envSource);
  const sendGatesOpen = areAgentMailSendAdapterGatesOpen(envSource);
  const mode = readAgentMailSendAdapterMode(envSource);
  const providerConversationId = String(input.provider_conversation_id ?? "").trim();
  const actions = Array.isArray(input.actions) ? input.actions : [];

  if (!sendGatesOpen || mode !== LIVE_MODE) {
    return {
      agentmail_post_session_send_attempted: false,
      agentmail_post_session_send_status: sendGatesOpen ? "send_adapter_not_live" : "send_adapter_disabled",
      agentmail_send_adapter_mode: mode,
      agentmail_message_sent: false,
      sent_count: 0,
      skipped_count: actions.length,
      send_results: actions.map((action) => ({
        ...safeSendResultBase(action),
        send_status: "send_adapter_not_live",
      })),
      live_agentmail_called: false,
      outbound_action_taken: false,
      action_claim_allowed: false,
    };
  }

  if (!agentMailConfig.gatesOpen || !agentMailConfig.inboxAddressMatchesDani || !agentMailConfig.apiKeyPresent) {
    return {
      agentmail_post_session_send_attempted: true,
      agentmail_post_session_send_status: "agentmail_adapter_not_configured",
      agentmail_send_adapter_mode: mode,
      agentmail_message_sent: false,
      sent_count: 0,
      skipped_count: actions.length,
      send_results: actions.map((action) => ({
        ...safeSendResultBase(action),
        send_status: "agentmail_adapter_not_configured",
      })),
      live_agentmail_called: false,
      outbound_action_taken: false,
      action_claim_allowed: false,
    };
  }

  const sendResults = [];
  let sentCount = 0;
  let liveAgentMailCalled = false;

  for (const action of actions) {
    const base = safeSendResultBase(action);
    const actionType = String(action?.action_type ?? "");
    if (!["email.user_followup", "email.admin_summary", "email.lead_intel"].includes(actionType)) {
      sendResults.push({ ...base, send_status: "unsupported_action_type" });
      continue;
    }
    if (action?.draft_created !== true || action?.send_attempted !== false) {
      sendResults.push({ ...base, send_status: "draft_not_sendable" });
      continue;
    }

    const recipientEmail = recipientForAction(action, input, envSource);
    if (!recipientEmail) {
      sendResults.push({ ...base, send_status: "recipient_unavailable" });
      continue;
    }

    const text = textFromAction(action);
    const subject = subjectFromAction(action);
    if (!text || !subject) {
      sendResults.push({ ...base, send_status: "message_content_unavailable" });
      continue;
    }

    let existingLedger;
    try {
      existingLedger = await readSendLedger(providerConversationId, actionType, { envSource, fetchImpl });
    } catch {
      sendResults.push({ ...base, send_status: "send_ledger_unavailable" });
      continue;
    }
    if (existingLedger?.send_status === "sent") {
      sendResults.push({
        ...base,
        send_status: "duplicate_send_prevented",
        agentmail_send_attempted: false,
        agentmail_message_sent: true,
        message_id_present: Boolean(existingLedger.message_id_present),
        thread_id_present: Boolean(existingLedger.thread_id_present),
        outbound_action_taken: false,
      });
      continue;
    }

    try {
      await writeSendLedger(
        providerConversationId,
        actionType,
        {
          send_status: "pending",
          action_type: actionType,
          created_at: timestamp(options.now),
        },
        { envSource, fetchImpl },
      );
    } catch {
      sendResults.push({ ...base, send_status: "send_ledger_unavailable" });
      continue;
    }

    try {
      const payload = await sendAgentMailMessage({
        inboxAddress: agentMailConfig.inboxAddress,
        recipientEmail,
        subject,
        text,
        providerConversationId,
        actionType,
        envSource,
        fetchImpl,
      });
      liveAgentMailCalled = true;
      sentCount += 1;
      try {
        await writeSendLedger(
          providerConversationId,
          actionType,
          {
            send_status: "sent",
            action_type: actionType,
            sent_at: timestamp(options.now),
            message_id_present: Boolean(payload?.message_id),
            thread_id_present: Boolean(payload?.thread_id),
          },
          { envSource, fetchImpl },
        );
      } catch {
        // The message was already accepted by AgentMail. Keep the response safe.
      }
      sendResults.push({
        ...base,
        agentmail_send_attempted: true,
        agentmail_message_sent: true,
        send_status: "sent",
        message_id_present: Boolean(payload?.message_id),
        thread_id_present: Boolean(payload?.thread_id),
        outbound_action_taken: true,
      });
    } catch {
      liveAgentMailCalled = true;
      sendResults.push({
        ...base,
        agentmail_send_attempted: true,
        agentmail_message_sent: false,
        send_status: "send_failed",
        outbound_action_taken: false,
      });
    }
  }

  return {
    agentmail_post_session_send_attempted: true,
    agentmail_post_session_send_status: sentCount > 0 ? "sent_or_partially_sent" : "no_messages_sent",
    agentmail_send_adapter_mode: mode,
    agentmail_message_sent: sentCount > 0,
    sent_count: sentCount,
    skipped_count: Math.max(actions.length - sentCount, 0),
    send_results: sendResults,
    sent_action_types: sendResults
      .filter((result) => result.agentmail_message_sent)
      .map((result) => result.action_type),
    live_agentmail_called: liveAgentMailCalled,
    outbound_action_taken: sentCount > 0,
    action_claim_allowed: sentCount > 0,
  };
}

export const AGENTMAIL_SEND_ADAPTER_VERSION = ADAPTER_VERSION;
