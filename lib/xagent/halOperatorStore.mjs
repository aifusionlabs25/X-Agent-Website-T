import { createHash } from "crypto";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";
import {
  areEmailMemoryStoreGatesOpen,
  readConversationEmailMapping,
  readStoredEmailMemoryRecordForConversation,
} from "./emailMemoryStore.mjs";
import { getXAgentProfile } from "./agentProfiles.mjs";
import { HAL_AGENT_SLUG, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const HAL_OPERATOR_SCHEMA_VERSION = "hal_operator_v1";
const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";
const OPERATOR_KILL_SWITCH_ENV = "XAGENT_HAL_OPERATOR_KILL_SWITCH";
const MAX_RECENT_SESSIONS = 40;
const MAX_RECENT_STARTS = 40;
const MAX_RECENT_RECEIPTS = 80;
const MAX_PENDING_ACTIONS = 40;
const MAX_USER_SESSIONS = 20;
const MAX_PREP_BRIEFS = 20;

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function nowIso(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isNaN(value.valueOf()) ? new Date(0).toISOString() : value.toISOString();
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function truncate(value, maxLength = 240) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function safeNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeProviderConversationId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) {
    throw new Error("provider_conversation_id is required");
  }
  return id;
}

function safeMeetingOrPrepText(value) {
  return truncate(
    String(value ?? "")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
      .replace(/\bprivate\s+google\s+drive\b/gi, "[unapproved private file reference]")
      .replace(/\b\+?\d[\d .()-]{7,}\d\b/g, "[phone redacted]"),
    320,
  );
}

function readStoreConfig(options = {}) {
  const envSource = options.env ?? process.env;
  const upstashUrl = options.upstashUrl ?? env(UPSTASH_URL_ENV, envSource);
  const upstashToken = options.upstashToken ?? env(UPSTASH_TOKEN_ENV, envSource);

  if (!areHalOperatorStoreGatesOpen(envSource)) {
    throw new Error("Hal operator store gates are closed");
  }
  if (!upstashUrl) throw new Error(`${UPSTASH_URL_ENV} is required`);
  if (!upstashToken) throw new Error(`${UPSTASH_TOKEN_ENV} is required`);

  return {
    upstashUrl: upstashUrl.replace(/\/$/, ""),
    upstashToken,
  };
}

export function areHalOperatorStoreGatesOpen(overrides = {}) {
  const killSwitch = overrides[OPERATOR_KILL_SWITCH_ENV] ?? env(OPERATOR_KILL_SWITCH_ENV, overrides);
  return areEmailMemoryStoreGatesOpen(overrides) && killSwitch !== "true";
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

function profile() {
  return getXAgentProfile(HAL_AGENT_SLUG);
}

function keyBase() {
  const hal = profile();
  return `xagent:${hal.tenantId}:${hal.agentSlug}:operator`;
}

function sessionArtifactKey(providerConversationId) {
  return `${keyBase()}:session:${providerConversationId}`;
}

function recentSessionsKey() {
  return `${keyBase()}:sessions:recent`;
}

function startArtifactKey(providerConversationId) {
  return `${keyBase()}:start:${providerConversationId}`;
}

function recentStartsKey() {
  return `${keyBase()}:starts:recent`;
}

function userSessionsKey(emailIdentityHash) {
  return `${keyBase()}:user:${emailIdentityHash}:sessions`;
}

function pendingActionsKey() {
  return `${keyBase()}:actions:pending`;
}

function receiptsKey() {
  return `${keyBase()}:receipts:recent`;
}

function prepBriefsKey() {
  return `${keyBase()}:prep:recent`;
}

function prepBriefKey(prepBriefId) {
  return `${keyBase()}:prep:${prepBriefId}`;
}

function mergeById(existingValue, nextItems, idField, maxLength) {
  const existing = Array.isArray(existingValue) ? existingValue : [];
  const byId = new Map();
  for (const item of [...existing, ...safeArray(nextItems)]) {
    const id = typeof item?.[idField] === "string" ? item[idField] : "";
    if (id) byId.set(id, item);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.created_at ?? b.status_created_at ?? "") - Date.parse(a.created_at ?? a.status_created_at ?? ""))
    .slice(0, maxLength);
}

function transcriptStats(transcript) {
  const turns = normalizeTranscriptTurns(transcript);
  const userTurns = turns.filter((turn) => turn.role === "user");
  const agentTurns = turns.filter((turn) => turn.role === "agent");
  return {
    turn_count: turns.length,
    user_turn_count: userTurns.length,
    agent_turn_count: agentTurns.length,
    redacted_transcript_hash: sha256(JSON.stringify(turns)),
  };
}

function collectSignals(transcript) {
  const turns = normalizeTranscriptTurns(transcript);
  const userText = turns
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content)
    .join(" ");
  const signals = [];
  if (/\b(?:meeting|call|agenda|prep|brief|interview)\b/i.test(userText)) {
    signals.push("meeting_or_briefing_signal");
  }
  if (/\b(?:email|send|recap|follow[- ]?up)\b/i.test(userText)) {
    signals.push("follow_up_signal");
  }
  if (/\b(?:approve|approval|decision|handoff|human|receipt|claim|completion)\b/i.test(userText)) {
    signals.push("approval_boundary_signal");
  }
  if (/\b(?:memory|remember|next time|again|last time)\b/i.test(userText)) {
    signals.push("memory_continuity_signal");
  }
  if (/\b(?:founder|operator|strategy|autopilot|copilot)\b/i.test(userText)) {
    signals.push("executive_autopilot_signal");
  }
  return signals.slice(0, 6);
}

function buildPostSessionBrief({ transcript, memoryRecord, communicationsResult, agentMailSendResult }) {
  const stats = transcriptStats(transcript);
  const signals = collectSignals(transcript);
  const memorySummary = typeof memoryRecord?.recalled_memory_summary === "string"
    ? truncate(memoryRecord.recalled_memory_summary, 520)
    : "No durable Hal memory summary was available for this session.";
  const sendCount = safeNumber(agentMailSendResult?.sent_count);
  const draftCount = safeNumber(communicationsResult?.draft_count);

  return {
    brief_id: `halbrief_${sha256(`${stats.redacted_transcript_hash}:${memoryRecord?.memory_record_id ?? "none"}`).slice(0, 16)}`,
    title: "Hal post-session operator brief",
    tl_dr: sendCount > 0
      ? `Hal captured the session, updated safe memory, and sent ${sendCount} AgentMail follow-up email${sendCount === 1 ? "" : "s"} with receipts.`
      : `Hal captured the session and prepared ${draftCount} reviewable follow-up item${draftCount === 1 ? "" : "s"} without claiming completion.`,
    memory_summary: memorySummary,
    signals,
    recommended_human_next_step: signals.includes("approval_boundary_signal")
      ? "Review the queued action before any executive-facing claim or external follow-up."
      : "Review the session brief and decide whether a human follow-up should happen.",
  };
}

function receiptFor({ providerConversationId, capability, status, evidence = {}, now }) {
  const createdAt = nowIso(now);
  return {
    receipt_id: `halrcpt_${sha256(`${HAL_OPERATOR_SCHEMA_VERSION}:${providerConversationId}:${capability}:${createdAt}`).slice(0, 16)}`,
    schema_version: HAL_OPERATOR_SCHEMA_VERSION,
    artifact_purpose: "hal_capability_receipt",
    tenant_id: profile().tenantId,
    agent_slug: HAL_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    capability,
    status,
    evidence,
    claim_allowed: status === "completed",
    created_at: createdAt,
    raw_email_stored: false,
    raw_transcript_stored: false,
    secret_stored: false,
  };
}

function buildReceipts({ artifact, communicationsResult, agentMailSendResult, emailActionStatusResult, now }) {
  const providerConversationId = artifact.provider_conversation_id;
  const sendCount = safeNumber(agentMailSendResult?.sent_count);
  const draftCount = safeNumber(communicationsResult?.draft_count);
  return [
    receiptFor({
      providerConversationId,
      capability: "tavus.transcript_processed",
      status: artifact.transcript.turn_count > 0 ? "completed" : "skipped",
      evidence: {
        turn_count: artifact.transcript.turn_count,
        redacted_transcript_hash: artifact.transcript.redacted_transcript_hash,
      },
      now,
    }),
    receiptFor({
      providerConversationId,
      capability: "hermes.memory_write",
      status: artifact.memory.memory_record_stored ? "completed" : "skipped",
      evidence: {
        memory_record_id: artifact.memory.memory_record_id,
        memory_history_record_count: artifact.memory.memory_history_record_count,
      },
      now,
    }),
    receiptFor({
      providerConversationId,
      capability: "hermes.post_session_brief",
      status: "completed",
      evidence: {
        brief_id: artifact.post_session_brief.brief_id,
        signal_count: artifact.post_session_brief.signals.length,
      },
      now,
    }),
    receiptFor({
      providerConversationId,
      capability: "hermes.action_plan",
      status: communicationsResult?.hermes_email_actions_planned ? "completed" : "skipped",
      evidence: {
        action_count: safeNumber(communicationsResult?.action_count),
        draft_count: draftCount,
        mode: communicationsResult?.hermes_email_actions_mode ?? "unknown",
      },
      now,
    }),
    receiptFor({
      providerConversationId,
      capability: "agentmail.post_session_send",
      status: sendCount > 0 ? "completed" : draftCount > 0 ? "queued_for_review" : "skipped",
      evidence: {
        sent_count: sendCount,
        sent_action_types: safeArray(agentMailSendResult?.sent_action_types),
        send_status: agentMailSendResult?.agentmail_post_session_send_status ?? null,
      },
      now,
    }),
    receiptFor({
      providerConversationId,
      capability: "hermes.action_status_store",
      status: emailActionStatusResult?.email_action_status_stored ? "completed" : "skipped",
      evidence: {
        status: emailActionStatusResult?.email_action_status ?? "unknown",
      },
      now,
    }),
  ];
}

function buildQueuedActions({ communicationsResult, agentMailSendResult, providerConversationId, now }) {
  const sentActionTypes = new Set(safeArray(agentMailSendResult?.sent_action_types));
  return safeArray(communicationsResult?.actions).map((action) => {
    const actionType = typeof action?.action_type === "string" ? action.action_type : "email.unknown";
    const completed = sentActionTypes.has(actionType);
    return {
      queue_item_id: `halqueue_${sha256(`${HAL_OPERATOR_SCHEMA_VERSION}:${providerConversationId}:${action?.action_id ?? actionType}`).slice(0, 16)}`,
      action_id: action?.action_id ?? null,
      action_type: actionType,
      provider_conversation_id: providerConversationId,
      title: actionType.replace(/^email\./, "").replace(/_/g, " "),
      status: completed ? "completed_with_receipt" : "requires_operator_review",
      subject_preview: truncate(action?.subject_preview, 160),
      provider_candidate: action?.provider_candidate ?? "unknown",
      operator_review_required_before_send: !completed,
      action_claim_allowed: completed,
      created_at: nowIso(now),
    };
  });
}

export function buildHalSessionArtifact(input = {}, options = {}) {
  const providerConversationId = safeProviderConversationId(input.provider_conversation_id);
  const mapping = input.mapping ?? {};
  const memoryRecord = input.memoryRecord ?? {};
  const communicationsResult = input.communicationsResult ?? {};
  const agentMailSendResult = input.agentMailSendResult ?? {};
  const stats = transcriptStats(input.transcript);
  const createdAt = nowIso(options.now);
  const hal = profile();

  return {
    schema_version: HAL_OPERATOR_SCHEMA_VERSION,
    artifact_purpose: "hal_operator_session_artifact",
    tenant_id: hal.tenantId,
    agent_slug: HAL_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    session_id: mapping.session_id ?? memoryRecord.session_id ?? null,
    visitor_id: mapping.visitor_id ?? memoryRecord.visitor_id ?? null,
    memory_identity_type: mapping.memory_identity_type ?? memoryRecord.memory_identity_type ?? "unknown",
    email_identity_hash: mapping.email_identity_hash ?? memoryRecord.email_identity_hash ?? null,
    session_started_at: mapping.started_at ?? null,
    session_completed_at: createdAt,
    created_at: createdAt,
    transcript: stats,
    memory: {
      memory_record_stored: Boolean(input.memoryOperatorResult?.memory_record_stored),
      memory_record_id: input.memoryOperatorResult?.memory_record_id ?? memoryRecord.memory_record_id ?? null,
      memory_history_record_count: safeNumber(input.memoryOperatorResult?.memory_history_record_count),
    },
    email_actions: {
      planned: Boolean(communicationsResult.hermes_email_actions_planned),
      status: communicationsResult.hermes_email_actions_status ?? "not_planned",
      mode: communicationsResult.hermes_email_actions_mode ?? "unknown",
      provider: communicationsResult.hermes_email_actions_provider ?? "unknown",
      action_count: safeNumber(communicationsResult.action_count),
      draft_count: safeNumber(communicationsResult.draft_count),
      send_count: safeNumber(agentMailSendResult.sent_count),
      sent_action_types: safeArray(agentMailSendResult.sent_action_types),
      operator_review_required_before_send: Boolean(communicationsResult.operator_review_required_before_send),
      action_claim_allowed: Boolean(agentMailSendResult.action_claim_allowed),
    },
    post_session_brief: buildPostSessionBrief({
      transcript: input.transcript,
      memoryRecord,
      communicationsResult,
      agentMailSendResult,
    }),
    safety: {
      raw_email_stored: false,
      normalized_email_stored: false,
      raw_transcript_stored: false,
      secret_stored: false,
      brian_private_context_claimed: false,
      impersonation_claim_allowed: false,
    },
  };
}

export function buildHalConversationStartArtifact(input = {}, options = {}) {
  const providerConversationId = safeProviderConversationId(input.provider_conversation_id);
  const createdAt = nowIso(options.now ?? input.started_at);
  const hal = profile();

  return {
    schema_version: HAL_OPERATOR_SCHEMA_VERSION,
    artifact_purpose: "hal_conversation_start_receipt",
    tenant_id: hal.tenantId,
    agent_slug: HAL_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    session_id: input.session_id ?? null,
    conversation_started_at: createdAt,
    created_at: createdAt,
    callback: {
      callback_url_present: Boolean(input.callback_url_present),
      callback_agent_param_present: Boolean(input.callback_agent_param_present),
      callback_token_present: Boolean(input.callback_token_present),
    },
    memory_context: {
      requested: Boolean(input.memory_context_requested),
      applied: Boolean(input.memory_context_applied),
      tavus_conversational_context_attached: Boolean(input.tavus_conversational_context_attached),
    },
    email_identity: {
      email_supplied: Boolean(input.email_supplied),
      mapping_attempted: Boolean(input.email_memory_mapping_attempted),
      mapping_written: Boolean(input.email_memory_mapping_written),
      outbound_contact_email_stored: Boolean(input.outbound_contact_email_stored),
      raw_email_stored: false,
    },
    tavus_post_session: {
      status: "waiting_for_transcription_ready",
      transcription_ready_seen: false,
      processed_at: null,
    },
    safety: {
      raw_email_stored: false,
      raw_transcript_stored: false,
      secret_stored: false,
    },
  };
}

export async function storeHalConversationStartReceipt(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  if (!areHalOperatorStoreGatesOpen(envSource)) {
    return {
      hal_operator_start_store_attempted: true,
      hal_operator_start_stored: false,
      hal_operator_start_status: "operator_store_disabled",
    };
  }

  const providerConversationId = safeProviderConversationId(input.provider_conversation_id);
  const artifact = buildHalConversationStartArtifact(
    {
      ...input,
      provider_conversation_id: providerConversationId,
    },
    options,
  );

  await redisSet(startArtifactKey(providerConversationId), artifact, options);
  const recentStarts = mergeById(await redisGet(recentStartsKey(), options), [artifact], "provider_conversation_id", MAX_RECENT_STARTS);
  await redisSet(recentStartsKey(), recentStarts, options);

  return {
    hal_operator_start_store_attempted: true,
    hal_operator_start_stored: true,
    hal_operator_start_status: "stored",
    production_database_mutated: true,
    raw_email_stored: false,
    raw_transcript_stored: false,
  };
}

export async function storeHalOperatorSessionArtifacts(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  if (options.agentSlug !== HAL_AGENT_SLUG && input.agentSlug !== HAL_AGENT_SLUG) {
    return {
      hal_operator_store_attempted: false,
      hal_operator_store_status: "not_hal_session",
    };
  }
  if (!areHalOperatorStoreGatesOpen(envSource)) {
    return {
      hal_operator_store_attempted: true,
      hal_operator_store_stored: false,
      hal_operator_store_status: "operator_store_disabled",
    };
  }

  const providerConversationId = safeProviderConversationId(input.provider_conversation_id);
  let mapping = null;
  let memoryRecord = null;

  try {
    mapping = await readConversationEmailMapping(providerConversationId, { ...options, agentSlug: HAL_AGENT_SLUG });
  } catch {
    mapping = null;
  }
  try {
    memoryRecord = await readStoredEmailMemoryRecordForConversation(providerConversationId, {
      ...options,
      agentSlug: HAL_AGENT_SLUG,
    });
  } catch {
    memoryRecord = null;
  }

  const artifact = buildHalSessionArtifact(
    {
      ...input,
      provider_conversation_id: providerConversationId,
      mapping,
      memoryRecord,
    },
    options,
  );
  const receipts = buildReceipts({
    artifact,
    communicationsResult: input.communicationsResult,
    agentMailSendResult: input.agentMailSendResult,
    emailActionStatusResult: input.emailActionStatusResult,
    now: options.now,
  });
  const queuedActions = buildQueuedActions({
    communicationsResult: input.communicationsResult,
    agentMailSendResult: input.agentMailSendResult,
    providerConversationId,
    now: options.now,
  });

  await redisSet(sessionArtifactKey(providerConversationId), artifact, options);

  try {
    const existingStart = await redisGet(startArtifactKey(providerConversationId), options);
    if (existingStart?.provider_conversation_id) {
      const completedStart = {
        ...existingStart,
        tavus_post_session: {
          ...(existingStart.tavus_post_session ?? {}),
          status: "transcription_ready_processed",
          transcription_ready_seen: true,
          processed_at: nowIso(options.now),
        },
      };
      await redisSet(startArtifactKey(providerConversationId), completedStart, options);
      const recentStarts = mergeById(await redisGet(recentStartsKey(), options), [completedStart], "provider_conversation_id", MAX_RECENT_STARTS);
      await redisSet(recentStartsKey(), recentStarts, options);
    }
  } catch {
    // Start receipts are diagnostic only; never block post-session processing.
  }

  const recentSessions = mergeById(await redisGet(recentSessionsKey(), options), [artifact], "provider_conversation_id", MAX_RECENT_SESSIONS);
  await redisSet(recentSessionsKey(), recentSessions, options);

  const recentReceipts = mergeById(await redisGet(receiptsKey(), options), receipts, "receipt_id", MAX_RECENT_RECEIPTS);
  await redisSet(receiptsKey(), recentReceipts, options);

  const pendingOnly = queuedActions.filter((action) => action.status !== "completed_with_receipt");
  const pendingActions = mergeById(await redisGet(pendingActionsKey(), options), pendingOnly, "queue_item_id", MAX_PENDING_ACTIONS);
  await redisSet(pendingActionsKey(), pendingActions, options);

  if (artifact.email_identity_hash) {
    const userSessions = mergeById(
      await redisGet(userSessionsKey(artifact.email_identity_hash), options),
      [artifact],
      "provider_conversation_id",
      MAX_USER_SESSIONS,
    );
    await redisSet(userSessionsKey(artifact.email_identity_hash), userSessions, options);
  }

  return {
    hal_operator_store_attempted: true,
    hal_operator_store_stored: true,
    hal_operator_store_status: "stored",
    hal_operator_session_artifact_id: artifact.provider_conversation_id,
    hal_operator_receipt_count: receipts.length,
    hal_operator_pending_action_count: pendingOnly.length,
    hal_operator_claim_safe_receipt_count: receipts.filter((receipt) => receipt.claim_allowed).length,
    production_database_mutated: true,
    raw_email_stored: false,
    raw_transcript_stored: false,
  };
}

function emptyDashboard(status = "operator_store_empty") {
  return {
    schema_version: HAL_OPERATOR_SCHEMA_VERSION,
    artifact_purpose: "hal_operator_dashboard_snapshot",
    tenant_id: profile().tenantId,
    agent_slug: HAL_AGENT_SLUG,
    status,
    generated_at: nowIso(),
    metrics: {
      recent_session_count: 0,
      recent_start_count: 0,
      waiting_transcript_count: 0,
      memory_write_count: 0,
      sent_email_count: 0,
      pending_action_count: 0,
      claim_safe_receipt_count: 0,
    },
    recent_sessions: [],
    recent_starts: [],
    pending_actions: [],
    receipts: [],
    prep_briefs: [],
    safety: {
      raw_email_returned: false,
      raw_transcript_returned: false,
      secret_returned: false,
    },
  };
}

export async function buildHalOperatorDashboardSnapshot(options = {}) {
  const envSource = options.env ?? process.env;
  if (!areHalOperatorStoreGatesOpen(envSource)) {
    return emptyDashboard("operator_store_disabled");
  }

  const recentSessions = safeArray(await redisGet(recentSessionsKey(), options));
  const recentStarts = safeArray(await redisGet(recentStartsKey(), options));
  const pendingActions = safeArray(await redisGet(pendingActionsKey(), options));
  const receipts = safeArray(await redisGet(receiptsKey(), options));
  const prepBriefs = safeArray(await redisGet(prepBriefsKey(), options));
  const limit = Math.max(1, Math.min(safeNumber(options.limit) || 12, 40));
  const completedSessionIds = new Set(recentSessions.map((session) => session.provider_conversation_id));
  const startsWaitingForTranscript = recentStarts.filter((start) => !completedSessionIds.has(start.provider_conversation_id));
  const storeStatus = recentSessions.length > 0
    ? "operator_store_ready"
    : recentStarts.length > 0
      ? "operator_store_waiting_for_transcript"
      : "operator_store_empty";

  return {
    ...emptyDashboard(storeStatus),
    generated_at: nowIso(options.now),
    metrics: {
      recent_session_count: recentSessions.length,
      recent_start_count: recentStarts.length,
      waiting_transcript_count: startsWaitingForTranscript.length,
      memory_write_count: receipts.filter((receipt) => receipt.capability === "hermes.memory_write" && receipt.status === "completed").length,
      sent_email_count: receipts
        .filter((receipt) => receipt.capability === "agentmail.post_session_send")
        .reduce((sum, receipt) => sum + safeNumber(receipt.evidence?.sent_count), 0),
      pending_action_count: pendingActions.length,
      claim_safe_receipt_count: receipts.filter((receipt) => receipt.claim_allowed).length,
    },
    recent_sessions: recentSessions.slice(0, limit).map((session) => ({
      provider_conversation_id: session.provider_conversation_id,
      session_id: session.session_id,
      created_at: session.created_at,
      memory_record_stored: Boolean(session.memory?.memory_record_stored),
      memory_record_id: session.memory?.memory_record_id ?? null,
      turn_count: safeNumber(session.transcript?.turn_count),
      user_turn_count: safeNumber(session.transcript?.user_turn_count),
      agent_turn_count: safeNumber(session.transcript?.agent_turn_count),
      brief: session.post_session_brief ?? null,
      email_actions: session.email_actions ?? {},
    })),
    recent_starts: recentStarts.slice(0, limit).map((start) => ({
      provider_conversation_id: start.provider_conversation_id,
      session_id: start.session_id,
      created_at: start.created_at,
      callback_url_present: Boolean(start.callback?.callback_url_present),
      callback_agent_param_present: Boolean(start.callback?.callback_agent_param_present),
      callback_token_present: Boolean(start.callback?.callback_token_present),
      email_supplied: Boolean(start.email_identity?.email_supplied),
      email_memory_mapping_written: Boolean(start.email_identity?.mapping_written),
      tavus_post_session_status: start.tavus_post_session?.status ?? "unknown",
      transcription_ready_seen: Boolean(start.tavus_post_session?.transcription_ready_seen),
    })),
    pending_actions: pendingActions.slice(0, limit),
    receipts: receipts.slice(0, limit),
    prep_briefs: prepBriefs.slice(0, limit),
  };
}

export function buildHalMeetingPrepBrief(input = {}, options = {}) {
  const title = safeMeetingOrPrepText(input.title || input.meeting_title || "Untitled meeting");
  const objective = safeMeetingOrPrepText(input.objective || input.goal || "Clarify the decision and the handoff boundary.");
  const attendeeContext = safeArray(input.attendees)
    .map((attendee) => safeMeetingOrPrepText(attendee?.name ?? attendee))
    .filter(Boolean)
    .slice(0, 8);
  const notes = safeMeetingOrPrepText(input.notes || input.context || "");
  const createdAt = nowIso(options.now);
  const prepBriefId = `halprep_${sha256(`${HAL_OPERATOR_SCHEMA_VERSION}:${title}:${objective}:${createdAt}`).slice(0, 16)}`;

  return {
    schema_version: HAL_OPERATOR_SCHEMA_VERSION,
    artifact_purpose: "hal_meeting_prep_brief",
    prep_brief_id: prepBriefId,
    tenant_id: profile().tenantId,
    agent_slug: HAL_AGENT_SLUG,
    title,
    objective,
    attendee_context: attendeeContext,
    context_notes: notes,
    agenda: [
      "Open with the decision or outcome the room needs.",
      "Separate what Hal can safely summarize from what a human must approve.",
      "Capture open questions, owners, and follow-up artifacts.",
    ],
    suggested_questions: [
      "What decision would make this meeting worth the time?",
      "What context is missing or stale?",
      "Which next step can be automated, and which one needs human judgment?",
    ],
    handoff_boundary: "Hal may prepare, summarize, and propose. Hal should not claim external execution without a provider receipt.",
    created_at: createdAt,
    raw_email_stored: false,
    raw_transcript_stored: false,
    outbound_action_taken: false,
  };
}

export async function storeHalMeetingPrepBrief(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  const brief = buildHalMeetingPrepBrief(input, options);
  if (!areHalOperatorStoreGatesOpen(envSource) || input.persist !== true) {
    return {
      ...brief,
      stored: false,
      store_status: input.persist === true ? "operator_store_disabled" : "preview_only",
    };
  }
  await redisSet(prepBriefKey(brief.prep_brief_id), brief, options);
  const prepBriefs = mergeById(await redisGet(prepBriefsKey(), options), [brief], "prep_brief_id", MAX_PREP_BRIEFS);
  await redisSet(prepBriefsKey(), prepBriefs, options);
  return {
    ...brief,
    stored: true,
    store_status: "stored",
  };
}

export { HAL_OPERATOR_SCHEMA_VERSION };
