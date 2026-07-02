import { areEmailMemoryStoreGatesOpen } from "./emailMemoryStore.mjs";
import { getXAgentProfile, resolveXAgentSlug } from "./agentProfiles.mjs";
import { DANI_AGENT_SLUG, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const STATUS_SCHEMA_VERSION = "t48_1_hermes_email_action_status_v1";
const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function nowIso(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isNaN(value.valueOf()) ? new Date(0).toISOString() : value.toISOString();
}

function cleanProviderConversationId(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSafeProviderConversationId(value) {
  const id = cleanProviderConversationId(value);
  return /^[A-Za-z0-9_-]{6,128}$/.test(id);
}

function assertSafeProviderConversationId(value) {
  const id = cleanProviderConversationId(value);
  if (!isSafeProviderConversationId(id)) {
    throw new Error("provider_conversation_id is required");
  }
  return id;
}

function readStoreConfig(options = {}) {
  const envSource = options.env ?? process.env;
  const upstashUrl = options.upstashUrl ?? env(UPSTASH_URL_ENV, envSource);
  const upstashToken = options.upstashToken ?? env(UPSTASH_TOKEN_ENV, envSource);

  if (!areEmailMemoryStoreGatesOpen(envSource, options)) {
    throw new Error("email action status store gates are closed");
  }
  if (!upstashUrl) {
    throw new Error(`${UPSTASH_URL_ENV} is required`);
  }
  if (!upstashToken) {
    throw new Error(`${UPSTASH_TOKEN_ENV} is required`);
  }

  return {
    upstashUrl: upstashUrl.replace(/\/$/, ""),
    upstashToken,
  };
}

function actionStatusKey(providerConversationId, agentSlug = DANI_AGENT_SLUG) {
  const profile = getXAgentProfile(agentSlug);
  return `xagent:${profile.tenantId}:${profile.agentSlug}:conversation:${providerConversationId}:email-actions:latest`;
}

async function upstashCommand(command, options = {}) {
  const config = readStoreConfig(options);
  const fetchImpl = options.fetchImpl ?? fetch;
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

async function redisSet(key, value, options = {}) {
  return upstashCommand(["SET", key, JSON.stringify(value)], options);
}

async function redisGet(key, options = {}) {
  const value = await upstashCommand(["GET", key], options);
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  return JSON.parse(value);
}

function safeNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeActionTypes(actions) {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((action) => (typeof action?.action_type === "string" ? action.action_type.trim() : ""))
    .filter((actionType) => /^email\.[a-z_]+$/.test(actionType))
    .slice(0, 8);
}

export function buildHermesEmailActionStatusRecord(input = {}, options = {}) {
  const providerConversationId = assertSafeProviderConversationId(input.provider_conversation_id);
  const agentSlug = resolveXAgentSlug(options.agentSlug ?? input.agentSlug);
  const profile = getXAgentProfile(agentSlug);
  const communicationsResult = input.communicationsResult ?? {};
  const memoryOperatorResult = input.memoryOperatorResult ?? {};
  const agentMailSendResult = input.agentMailSendResult ?? {};
  const actionTypes = safeActionTypes(communicationsResult.actions);
  const actionCount = safeNumber(communicationsResult.action_count ?? actionTypes.length);
  const draftCount = safeNumber(communicationsResult.draft_count);
  const sentActionTypes = Array.isArray(agentMailSendResult.sent_action_types)
    ? agentMailSendResult.sent_action_types.filter((actionType) => actionTypes.includes(actionType))
    : [];
  const sendCount = safeNumber(agentMailSendResult.sent_count ?? sentActionTypes.length);

  return {
    schema_version: STATUS_SCHEMA_VERSION,
    artifact_purpose: "xagent_hermes_email_action_status",
    tenant_id: profile.tenantId,
    agent_slug: profile.agentSlug,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    status_created_at: nowIso(options.now),
    email_action_plan_status: communicationsResult.hermes_email_actions_status ?? "not_planned",
    email_action_plan_created: Boolean(communicationsResult.hermes_email_actions_planned),
    email_action_mode: communicationsResult.hermes_email_actions_mode ?? "unknown",
    email_action_provider: communicationsResult.hermes_email_actions_provider ?? "unknown",
    action_count: actionCount,
    draft_count: draftCount,
    send_count: sendCount,
    action_types: actionTypes,
    sent_action_types: sentActionTypes,
    memory_record_stored: Boolean(memoryOperatorResult.memory_record_stored),
    operator_review_required_before_send: Boolean(communicationsResult.operator_review_required_before_send),
    safe_status_only: true,
    action_claim_allowed: Boolean(agentMailSendResult.action_claim_allowed),
    agentmail_inbox_created: false,
    agentmail_called: Boolean(agentMailSendResult.live_agentmail_called),
    live_agentmail_called: Boolean(agentMailSendResult.live_agentmail_called),
    agentmail_send_attempted: Boolean(agentMailSendResult.agentmail_post_session_send_attempted),
    agentmail_message_sent: Boolean(agentMailSendResult.agentmail_message_sent),
    resend_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
    production_memory_database_mutated: false,
    raw_email_stored: false,
    normalized_email_stored: false,
    email_hash_stored: false,
    raw_session_text_stored: false,
    draft_subject_stored: false,
    draft_body_stored: false,
    prompt_text_stored: false,
    secret_stored: false,
  };
}

function safeStatusResponse(record) {
  if (!record) return null;
  return {
    provider_conversation_id: record.provider_conversation_id,
    email_action_plan_status: record.email_action_plan_status,
    email_action_plan_created: Boolean(record.email_action_plan_created),
    email_action_mode: record.email_action_mode,
    email_action_provider: record.email_action_provider,
    action_count: safeNumber(record.action_count),
    draft_count: safeNumber(record.draft_count),
    send_count: safeNumber(record.send_count),
    action_types: Array.isArray(record.action_types) ? record.action_types : [],
    sent_action_types: Array.isArray(record.sent_action_types) ? record.sent_action_types : [],
    memory_record_stored: Boolean(record.memory_record_stored),
    operator_review_required_before_send: Boolean(record.operator_review_required_before_send),
    action_claim_allowed: Boolean(record.action_claim_allowed),
    agentmail_send_attempted: Boolean(record.agentmail_send_attempted),
    agentmail_message_sent: Boolean(record.agentmail_message_sent),
    resend_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
    safe_status_only: true,
  };
}

export async function storeHermesEmailActionStatus(input = {}, options = {}) {
  const providerConversationId = assertSafeProviderConversationId(input.provider_conversation_id);
  const agentSlug = resolveXAgentSlug(options.agentSlug ?? input.agentSlug);
  const record = buildHermesEmailActionStatusRecord(
    {
      ...input,
      agentSlug,
      provider_conversation_id: providerConversationId,
    },
    { ...options, agentSlug },
  );
  await redisSet(actionStatusKey(providerConversationId, agentSlug), record, options);
  return {
    email_action_status_store_attempted: true,
    email_action_status_stored: true,
    email_action_status: "stored",
    provider_conversation_id: providerConversationId,
    action_count: record.action_count,
    draft_count: record.draft_count,
    send_count: record.send_count,
    action_claim_allowed: Boolean(record.action_claim_allowed),
    outbound_action_taken: Boolean(record.agentmail_message_sent),
    safe_status_only: true,
  };
}

export async function buildHermesEmailActionStatusLookup(input = {}, options = {}) {
  const rawProviderConversationId = cleanProviderConversationId(input.provider_conversation_id);
  const agentSlug = resolveXAgentSlug(options.agentSlug ?? input.agentSlug);
  if (!rawProviderConversationId || !isSafeProviderConversationId(rawProviderConversationId)) {
    return {
      provider_conversation_id_supplied: Boolean(rawProviderConversationId),
      provider_conversation_id_valid: false,
      email_action_status_checked: false,
      email_action_status_available: false,
      safe_status_only: true,
    };
  }

  const envSource = options.env ?? process.env;
  if (!areEmailMemoryStoreGatesOpen(envSource, { ...options, agentSlug })) {
    return {
      provider_conversation_id_supplied: true,
      provider_conversation_id_valid: true,
      email_action_status_checked: false,
      email_action_status_available: false,
      email_action_status: "status_store_disabled",
      safe_status_only: true,
    };
  }

  try {
    const record = await redisGet(actionStatusKey(rawProviderConversationId, agentSlug), options);
    const safeRecord = safeStatusResponse(record);
    return {
      provider_conversation_id_supplied: true,
      provider_conversation_id_valid: true,
      email_action_status_checked: true,
      email_action_status_available: Boolean(safeRecord),
      email_action_status: safeRecord?.email_action_plan_status ?? "not_found",
      ...(safeRecord ?? {}),
      safe_status_only: true,
    };
  } catch {
    return {
      provider_conversation_id_supplied: true,
      provider_conversation_id_valid: true,
      email_action_status_checked: true,
      email_action_status_available: false,
      email_action_status: "status_lookup_error",
      safe_status_only: true,
    };
  }
}

export const HERMES_EMAIL_ACTION_STATUS_STORE_VERSION = STATUS_SCHEMA_VERSION;
