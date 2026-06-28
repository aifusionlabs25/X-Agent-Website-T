import { createHash } from "crypto";
import { normalizeEmailIdentityInput } from "./emailIdentityMemoryLookup.mjs";
import { buildSessionStartMemoryContextPreview } from "./sessionMemoryContext.mjs";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const STORE_SCHEMA_VERSION = "t41_email_memory_store_v1";
const ENABLED_ENV = "XAGENT_EMAIL_MEMORY_STORE_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH";
const OUTBOUND_CONTACT_ENABLED_ENV = "XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_ENABLED";
const OUTBOUND_CONTACT_DANI_PILOT_ENV = "XAGENT_DANI_EMAIL_OUTBOUND_CONTACT_STORE_PILOT_ENABLED";
const OUTBOUND_CONTACT_KILL_SWITCH_ENV = "XAGENT_EMAIL_OUTBOUND_CONTACT_STORE_KILL_SWITCH";
const SALT_ENV = "XAGENT_EMAIL_IDENTITY_SALT";
const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";
const FIXTURE_SALT = "h-email-2-fixture-only-non-production-salt";
const MAX_MEMORY_HISTORY_RECORDS = 8;

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashSummary(summary) {
  return sha256(String(summary ?? "").replace(/\s+/g, " ").trim());
}

function truncate(value, maxLength) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV, overrides),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV, overrides),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV, overrides),
  };
}

export function areEmailMemoryStoreGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

function readOutboundContactGateConfig(overrides = {}) {
  return {
    enabled: overrides[OUTBOUND_CONTACT_ENABLED_ENV] ?? env(OUTBOUND_CONTACT_ENABLED_ENV, overrides),
    daniPilotEnabled:
      overrides[OUTBOUND_CONTACT_DANI_PILOT_ENV] ?? env(OUTBOUND_CONTACT_DANI_PILOT_ENV, overrides),
    killSwitch: overrides[OUTBOUND_CONTACT_KILL_SWITCH_ENV] ?? env(OUTBOUND_CONTACT_KILL_SWITCH_ENV, overrides),
  };
}

export function areEmailOutboundContactStoreGatesOpen(overrides = {}) {
  const gates = readOutboundContactGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

function readStoreConfig(options = {}) {
  const envSource = options.env ?? process.env;
  const identitySalt = options.identitySalt ?? env(SALT_ENV, envSource);
  const upstashUrl = options.upstashUrl ?? env(UPSTASH_URL_ENV, envSource);
  const upstashToken = options.upstashToken ?? env(UPSTASH_TOKEN_ENV, envSource);

  if (!areEmailMemoryStoreGatesOpen(envSource)) {
    throw new Error("email memory store gates are closed");
  }
  if (!identitySalt || identitySalt === FIXTURE_SALT) {
    throw new Error(`${SALT_ENV} must be configured with a non-fixture value`);
  }
  assertString(upstashUrl, UPSTASH_URL_ENV);
  assertString(upstashToken, UPSTASH_TOKEN_ENV);

  return {
    identitySalt,
    upstashUrl: upstashUrl.replace(/\/$/, ""),
    upstashToken,
  };
}

export function deriveStoredEmailIdentityHash(email, options = {}) {
  const normalizedEmail = normalizeEmailIdentityInput(email);
  const identitySalt = assertString(options.identitySalt, "identitySalt");
  return sha256(`${identitySalt}:${DANI_TENANT_ID}:${DANI_AGENT_SLUG}:${normalizedEmail}`);
}

function emailVisitorId(emailIdentityHash) {
  return `email/${emailIdentityHash}`;
}

function visitorMemoryNamespace(emailIdentityHash) {
  return `xagents/${DANI_TENANT_ID}/${DANI_AGENT_SLUG}/${emailVisitorId(emailIdentityHash)}`;
}

function conversationMappingKey(providerConversationId) {
  return `xagent:${DANI_TENANT_ID}:${DANI_AGENT_SLUG}:conversation:${providerConversationId}`;
}

function latestMemoryKey(emailIdentityHash) {
  return `xagent:${DANI_TENANT_ID}:${DANI_AGENT_SLUG}:email:${emailIdentityHash}:memory:latest`;
}

function memoryHistoryKey(emailIdentityHash) {
  return `xagent:${DANI_TENANT_ID}:${DANI_AGENT_SLUG}:email:${emailIdentityHash}:memory:history`;
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

function isMemoryRecord(value) {
  return Boolean(
    value
    && typeof value === "object"
    && typeof value.memory_record_id === "string"
    && typeof value.recalled_memory_summary === "string"
    && typeof value.visitor_memory_namespace === "string",
  );
}

function normalizeMemoryHistoryPayload(value) {
  if (!value) return [];
  const records = Array.isArray(value)
    ? value
    : Array.isArray(value.records)
      ? value.records
      : [];
  return records.filter(isMemoryRecord);
}

function memoryRecordSortTime(record) {
  const time = Date.parse(record.created_at ?? "");
  return Number.isFinite(time) ? time : 0;
}

function mergeMemoryHistory({ existingHistory, previousLatest, nextRecord } = {}) {
  const byId = new Map();
  const candidates = [
    ...normalizeMemoryHistoryPayload(existingHistory),
    previousLatest,
    nextRecord,
  ].filter(isMemoryRecord);

  for (const record of candidates) {
    byId.set(record.memory_record_id, record);
  }

  return [...byId.values()]
    .sort((a, b) => memoryRecordSortTime(a) - memoryRecordSortTime(b))
    .slice(-MAX_MEMORY_HISTORY_RECORDS);
}

function buildCombinedMemorySummary(records) {
  const usable = records.filter(isMemoryRecord);
  const combined = usable
    .map((record, index) => `Prior session ${index + 1}: ${record.recalled_memory_summary}`)
    .join(" | ");
  return truncate(combined, 1800);
}

function averageConfidence(records) {
  const values = records
    .map((record) => Number(record.confidence))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return 0.58;
  return Math.min(0.9, values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getSuppliedEmail(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  if (typeof body.email === "string" && body.email.trim()) return body.email;
  if (typeof body.returning_email === "string" && body.returning_email.trim()) return body.returning_email;
  if (typeof body.returningEmail === "string" && body.returningEmail.trim()) return body.returningEmail;
  return undefined;
}

export async function storeConversationEmailMappingForStart(input, options = {}) {
  const email = getSuppliedEmail(input?.requestBody);
  if (!email || !areEmailMemoryStoreGatesOpen(options.env ?? process.env)) {
    return {
      email_memory_mapping_attempted: false,
      email_memory_mapping_written: false,
    };
  }

  const config = readStoreConfig(options);
  const normalizedEmail = normalizeEmailIdentityInput(email);
  const emailIdentityHash = deriveStoredEmailIdentityHash(normalizedEmail, { identitySalt: config.identitySalt });
  const providerConversationId = assertString(input?.provider_conversation_id, "provider_conversation_id");
  const sessionId = assertString(input?.session_id, "session_id");
  const startedAt = typeof input?.started_at === "number" ? input.started_at : Date.now();
  const outboundContactStoreEnabled = areEmailOutboundContactStoreGatesOpen(options.env ?? process.env);

  const mapping = {
    schema_version: STORE_SCHEMA_VERSION,
    artifact_purpose: "xagent_conversation_email_memory_mapping",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    session_id: sessionId,
    memory_identity_type: "email_identity_hash",
    email_identity_hash: emailIdentityHash,
    visitor_id: emailVisitorId(emailIdentityHash),
    visitor_memory_namespace: visitorMemoryNamespace(emailIdentityHash),
    outbound_contact_email: outboundContactStoreEnabled ? normalizedEmail : null,
    outbound_contact_email_stored: outboundContactStoreEnabled,
    started_at: new Date(startedAt).toISOString(),
    created_at: new Date().toISOString(),
    raw_email_stored: false,
    normalized_email_stored: outboundContactStoreEnabled,
  };

  await redisSet(conversationMappingKey(providerConversationId), mapping, options);

  return {
    email_memory_mapping_attempted: true,
    email_memory_mapping_written: true,
    provider_conversation_id: providerConversationId,
    email_identity_hash_derived: true,
    raw_email_stored: false,
    normalized_email_stored: outboundContactStoreEnabled,
    outbound_contact_email_stored: outboundContactStoreEnabled,
  };
}

export async function readConversationEmailMapping(providerConversationId, options = {}) {
  const id = assertString(providerConversationId, "provider_conversation_id");
  return redisGet(conversationMappingKey(id), options);
}

export async function readConversationOutboundContactEmail(providerConversationId, options = {}) {
  const mapping = await readConversationEmailMapping(providerConversationId, options);
  if (!mapping?.outbound_contact_email_stored) return null;
  if (typeof mapping.outbound_contact_email !== "string" || !mapping.outbound_contact_email.trim()) return null;
  return normalizeEmailIdentityInput(mapping.outbound_contact_email);
}

function redactEmailLikeMemoryText(content) {
  return String(content ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:[a-z0-9]\s*[- ]\s*){2,}[a-z0-9]?\s*(?:at|@)\s*(?:gmail|yahoo|outlook|hotmail)(?:\s*dot\s*|\.)\s*[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b[a-z0-9._%+-]+\s+(?:at)\s+[a-z0-9.-]+(?:\s+dot\s+|\.)[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:gmail|yahoo|outlook|hotmail)\s*(?:dot|\.)\s*[a-z]{2,}\b/gi, "[email domain redacted]");
}

function softenUnconfirmedOutboundClaims(content) {
  return String(content ?? "")
    .replace(/\b(?:I|we|our team|they)\s*(?:'ll|will)\s+send\b/gi, "the request is to send")
    .replace(/\b(?:I|we|our team|they)\s*(?:'ll|will)\s+(?:book|schedule|lock in)\b/gi, "the request is to schedule")
    .replace(/\b(?:sent|booked|scheduled|created|updated)\s+(?:an?\s+)?(?:email|invite|meeting|crm|record|quote)\b/gi, "requested a follow-up action");
}

function safeMemoryText(content) {
  return softenUnconfirmedOutboundClaims(redactEmailLikeMemoryText(content));
}

function includesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function selectTurns(turns, patterns, used = new Set(), limit = 1) {
  const selected = [];
  for (const [index, turn] of turns.entries()) {
    if (used.has(index)) continue;
    if (!includesAny(turn.toLowerCase(), patterns)) continue;
    used.add(index);
    selected.push(turn);
    if (selected.length >= limit) break;
  }
  return selected;
}

function formatSectionValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" ");
  }
  return value;
}

function formatMemorySummarySections(sections, fallbackTurns) {
  const lines = [];

  for (const [label, value] of sections) {
    const formatted = formatSectionValue(value);
    if (!formatted) continue;
    lines.push(`${label}: ${truncate(formatted, 260)}`);
  }

  if (lines.length > 0) {
    return truncate(lines.join(" | "), 900);
  }

  const fallback = fallbackTurns.length > 0
    ? fallbackTurns.slice(0, 4).join(" ")
    : "Visitor completed a Dani session, but no durable business preference was captured safely.";
  return truncate(`Visitor context: ${fallback}`, 900);
}

export function summarizeTranscriptForMemory(transcript) {
  const normalized = normalizeTranscriptTurns(transcript);
  const safeTurns = normalized
    .map((turn) => ({
      role: turn.role,
      content: safeMemoryText(turn.content),
    }))
    .filter((turn) => turn.content.length >= 18);
  const userTurns = safeTurns
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content);
  const agentTurns = safeTurns
    .filter((turn) => turn.role === "agent")
    .map((turn) => turn.content);

  const used = new Set();
  const businessContext = selectTurns(userTurns, [
    /\b(?:run|own|have|website|site|store|shop|company|business|sell|products?)\b/i,
  ], used, 2);
  const primaryGoal = selectTurns(userTurns, [
    /\b(?:want|need|looking|interested|goal|sales|conversion|checkout|lead|support|agent|x[-\s]?agent)\b/i,
  ], used, 2);
  const implementationNotes = selectTurns(userTurns, [
    /\b(?:api|database|inventory|cart|checkout|crm|calendar|product page|pages|icon|bottom[-\s]?right|embed|integration)\b/i,
  ], used, 2);
  const successSignals = selectTurns(userTurns, [
    /\b(?:metric|kpi|success|conversion|upsell|abandon|traffic|concurrent|world cup|visits|scale|pricing|cost)\b/i,
  ], used, 2);
  const nextStepSignals = selectTurns(userTurns, [
    /\b(?:demo|call|meeting|appointment|pricing|quote|follow[-\s]?up|recap|next week|tuesday|schedule|invite|a\.m\.|p\.m\.)\b/i,
  ], used, 3);
  const agentNextStepSignals = selectTurns(agentTurns, [
    /\b(?:technical call|follow[-\s]?up call|meeting|appointment|next week|tuesday|schedule|invite|a\.m\.|p\.m\.|checklist|sales and engineering|confirmation)\b/i,
  ], new Set(), 2);

  return {
    summary: formatMemorySummarySections([
      ["Visitor/business context", businessContext],
      ["Primary goal", primaryGoal],
      ["Implementation notes", implementationNotes],
      ["Success or scale signals", successSignals],
      ["Next-step signals", [...nextStepSignals, ...agentNextStepSignals]],
    ], userTurns),
    confidence: userTurns.length >= 3 ? 0.78 : 0.58,
    redacted_transcript_hash: sha256(JSON.stringify(normalized)),
  };
}

function assertDaniConversationMapping(mapping) {
  if (!mapping || typeof mapping !== "object") {
    throw new Error("conversation email mapping is required");
  }
  if (mapping.tenant_id !== DANI_TENANT_ID || mapping.agent_slug !== DANI_AGENT_SLUG) {
    throw new Error("conversation email mapping must be scoped to Dani");
  }
  return mapping;
}

export function buildEmailMemoryRecordFromSummary({
  mapping,
  summary,
  confidence,
  redacted_transcript_hash,
  transcriptMetadata,
  operatorMetadata,
} = {}) {
  const scopedMapping = assertDaniConversationMapping(mapping);
  const cleanSummary = assertString(summary, "summary");
  const numericConfidence = Number(confidence);
  if (!Number.isFinite(numericConfidence) || numericConfidence <= 0) {
    throw new Error("confidence is required");
  }
  const transcriptHash = assertString(redacted_transcript_hash, "redacted_transcript_hash");
  const summaryHash = hashSummary(cleanSummary);
  const recordSeed = [
    STORE_SCHEMA_VERSION,
    scopedMapping.provider_conversation_id,
    scopedMapping.session_id,
    summaryHash,
  ].join(":");
  const memoryRecordId = `hxemr_${sha256(recordSeed).slice(0, 16)}`;
  const memoryNamespace = `${scopedMapping.visitor_memory_namespace}/${scopedMapping.session_id}`;

  const recordWithoutHash = {
    schema_version: STORE_SCHEMA_VERSION,
    artifact_purpose: "xagent_email_identity_memory_record",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    visitor_id: scopedMapping.visitor_id,
    visitor_memory_namespace: scopedMapping.visitor_memory_namespace,
    memory_namespace: memoryNamespace,
    memory_record_id: memoryRecordId,
    memory_identity_type: "email_identity_hash",
    email_identity_hash: scopedMapping.email_identity_hash,
    session_id: scopedMapping.session_id,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: scopedMapping.provider_conversation_id,
    recalled_memory_summary: cleanSummary,
    confidence: numericConfidence,
    summary_hash: summaryHash,
    redacted_transcript_hash: transcriptHash,
    tavus_transcript_metadata: transcriptMetadata ?? {},
    hermes_operator_metadata: operatorMetadata ?? {},
    created_at: new Date().toISOString(),
    raw_email_stored: false,
    normalized_email_stored: false,
    raw_transcript_stored: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    outbound_action_taken: false,
    production_memory_database_mutated: true,
  };

  return {
    ...recordWithoutHash,
    record_hash: sha256(JSON.stringify(recordWithoutHash)),
  };
}

export function buildEmailMemoryRecordFromTranscript({ mapping, transcript, transcriptMetadata, operatorMetadata } = {}) {
  assertDaniConversationMapping(mapping);
  const summaryResult = summarizeTranscriptForMemory(transcript);
  return buildEmailMemoryRecordFromSummary({
    mapping,
    summary: summaryResult.summary,
    confidence: summaryResult.confidence,
    redacted_transcript_hash: summaryResult.redacted_transcript_hash,
    transcriptMetadata,
    operatorMetadata,
  });
}

export function buildSessionStartMemoryContextFromStoredRecord(record, options = {}) {
  return buildSessionStartMemoryContextFromStoredRecords([record], options);
}

export function buildSessionStartMemoryContextFromStoredRecords(records, options = {}) {
  const memoryRecords = normalizeMemoryHistoryPayload(records);
  if (memoryRecords.length === 0) {
    throw new Error("stored email memory record is required");
  }
  const firstRecord = memoryRecords[0];
  const latestRecord = memoryRecords.at(-1);
  const visitorMemoryNamespace = assertString(firstRecord.visitor_memory_namespace, "visitor_memory_namespace");

  for (const record of memoryRecords) {
    if (record.agent_slug !== firstRecord.agent_slug || record.tenant_id !== firstRecord.tenant_id) {
      throw new Error("stored email memory records must share tenant and agent");
    }
    if (record.visitor_memory_namespace !== visitorMemoryNamespace) {
      throw new Error("stored email memory records must share visitor_memory_namespace");
    }
  }

  const nextSessionId = assertString(options.nextSessionId, "nextSessionId");
  const recalledMemorySummary = memoryRecords.length === 1
    ? assertString(latestRecord.recalled_memory_summary, "recalled_memory_summary")
    : buildCombinedMemorySummary(memoryRecords);
  const summaryHash = hashSummary(recalledMemorySummary);
  const aggregateRecordHash = memoryRecords.length === 1
    ? assertString(latestRecord.record_hash, "record_hash")
    : sha256(JSON.stringify({
      schema_version: STORE_SCHEMA_VERSION,
      memory_record_ids: memoryRecords.map((record) => record.memory_record_id),
      summary_hash: summaryHash,
    }));

  const memoryContext = {
    artifact_purpose: "xagent_email_identity_next_session_context_from_store",
    xagent_memory_recall_preview_version: STORE_SCHEMA_VERSION,
    agent_slug: latestRecord.agent_slug,
    tenant_id: latestRecord.tenant_id,
    visitor_id: latestRecord.visitor_id,
    next_session_id: nextSessionId,
    prior_session_id: latestRecord.session_id,
    visitor_memory_namespace: visitorMemoryNamespace,
    prior_memory_record_ids: memoryRecords.map((record) => assertString(record.memory_record_id, "memory_record_id")),
    recalled_memory_summary: recalledMemorySummary,
    confidence: averageConfidence(memoryRecords),
    provenance: {
      memory_record_id: latestRecord.memory_record_id,
      memory_namespace: latestRecord.memory_namespace,
      visitor_memory_namespace: visitorMemoryNamespace,
      memory_type: memoryRecords.length === 1
        ? "email_identity_memory_store_record"
        : "email_identity_memory_store_history_rollup",
      provider: latestRecord.provider,
      provider_conversation_id: latestRecord.provider_conversation_id,
      summary_hash: summaryHash,
      redacted_transcript_hash: latestRecord.redacted_transcript_hash,
      record_hash: aggregateRecordHash,
      record_hash_verified: true,
      summary_hash_verified: true,
      memory_record_count: memoryRecords.length,
    },
    allowed_use: [
      "remember prior goals and business context",
      "remember safe product or integration preferences",
      "support continuity in a new Dani session",
    ],
    forbidden_use: [
      "do not expose raw email",
      "do not claim emails were sent",
      "do not claim CRM updates or outbound actions happened",
      "do not reveal hashes, namespaces, proof IDs, or backend machinery to the visitor",
    ],
    live_turn_loop_dependency: false,
    hermes_execution_performed: false,
    ollama_generate_called: false,
    production_memory_database_mutated: false,
    outbound_action_taken: false,
    raw_transcript_content_included: false,
  };

  return buildSessionStartMemoryContextPreview(memoryContext);
}

export async function storeEmailMemoryRecord(record, options = {}) {
  const emailIdentityHash = assertString(record?.email_identity_hash, "email_identity_hash");
  const existingHistory = await redisGet(memoryHistoryKey(emailIdentityHash), options);
  const previousLatest = await redisGet(latestMemoryKey(emailIdentityHash), options);
  const memoryHistory = mergeMemoryHistory({
    existingHistory,
    previousLatest,
    nextRecord: record,
  });
  await redisSet(latestMemoryKey(emailIdentityHash), record, options);
  await redisSet(memoryHistoryKey(emailIdentityHash), memoryHistory, options);
  return {
    memory_record_stored: true,
    memory_record_id: record.memory_record_id,
    memory_history_record_count: memoryHistory.length,
    production_memory_database_mutated: true,
  };
}

export async function readStoredEmailMemoryContext(input, options = {}) {
  if (!areEmailMemoryStoreGatesOpen(options.env ?? process.env)) {
    return null;
  }
  const config = readStoreConfig(options);
  const emailIdentityHash = deriveStoredEmailIdentityHash(input?.email, { identitySalt: config.identitySalt });
  const record = await redisGet(latestMemoryKey(emailIdentityHash), options);
  const storedHistory = await redisGet(memoryHistoryKey(emailIdentityHash), options);
  const memoryHistory = mergeMemoryHistory({
    existingHistory: storedHistory,
    previousLatest: record,
  });
  if (memoryHistory.length === 0) return null;

  return {
    lookup_source: "upstash_email_identity_memory_store",
    email_valid: true,
    email_identity_hash_derived: true,
    memory_context: buildSessionStartMemoryContextFromStoredRecords(memoryHistory, {
      nextSessionId: input.nextSessionId,
    }),
    memory_history_record_count: memoryHistory.length,
  };
}

export async function readStoredEmailMemoryRecordForConversation(providerConversationId, options = {}) {
  if (!areEmailMemoryStoreGatesOpen(options.env ?? process.env)) {
    return null;
  }

  const mapping = await readConversationEmailMapping(providerConversationId, options);
  if (!mapping?.email_identity_hash) {
    return null;
  }

  return redisGet(latestMemoryKey(mapping.email_identity_hash), options);
}

export async function storeEmailMemoryFromConversationTranscript({ provider_conversation_id, transcript, transcriptMetadata } = {}, options = {}) {
  const mapping = await readConversationEmailMapping(provider_conversation_id, options);
  if (!mapping) {
    return {
      memory_store_attempted: true,
      memory_record_stored: false,
      memory_store_status: "conversation_email_mapping_not_found",
    };
  }

  const record = buildEmailMemoryRecordFromTranscript({
    mapping,
    transcript,
    transcriptMetadata,
  });
  const storeResult = await storeEmailMemoryRecord(record, options);

  return {
    memory_store_attempted: true,
    memory_record_stored: true,
    memory_store_status: "stored",
    memory_record_id: record.memory_record_id,
    memory_history_record_count: storeResult.memory_history_record_count,
    provider_conversation_id: mapping.provider_conversation_id,
    raw_email_stored: false,
    normalized_email_stored: false,
    raw_transcript_stored: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    outbound_action_taken: false,
    production_memory_database_mutated: true,
  };
}
