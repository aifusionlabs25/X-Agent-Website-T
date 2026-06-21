import { createHash } from "crypto";
import { normalizeEmailIdentityInput } from "./emailIdentityMemoryLookup.mjs";
import { buildSessionStartMemoryContextPreview } from "./sessionMemoryContext.mjs";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const STORE_SCHEMA_VERSION = "t41_email_memory_store_v1";
const ENABLED_ENV = "XAGENT_EMAIL_MEMORY_STORE_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH";
const SALT_ENV = "XAGENT_EMAIL_IDENTITY_SALT";
const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";
const FIXTURE_SALT = "h-email-2-fixture-only-non-production-salt";

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
  const emailIdentityHash = deriveStoredEmailIdentityHash(email, { identitySalt: config.identitySalt });
  const providerConversationId = assertString(input?.provider_conversation_id, "provider_conversation_id");
  const sessionId = assertString(input?.session_id, "session_id");
  const startedAt = typeof input?.started_at === "number" ? input.started_at : Date.now();

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
    started_at: new Date(startedAt).toISOString(),
    created_at: new Date().toISOString(),
    raw_email_stored: false,
    normalized_email_stored: false,
  };

  await redisSet(conversationMappingKey(providerConversationId), mapping, options);

  return {
    email_memory_mapping_attempted: true,
    email_memory_mapping_written: true,
    provider_conversation_id: providerConversationId,
    email_identity_hash_derived: true,
    raw_email_stored: false,
    normalized_email_stored: false,
  };
}

export async function readConversationEmailMapping(providerConversationId, options = {}) {
  const id = assertString(providerConversationId, "provider_conversation_id");
  return redisGet(conversationMappingKey(id), options);
}

function redactEmailLikeMemoryText(content) {
  return String(content ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:[a-z0-9]\s*[- ]\s*){2,}[a-z0-9]?\s*(?:at|@)\s*(?:gmail|yahoo|outlook|hotmail)(?:\s*dot\s*|\.)\s*[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b[a-z0-9._%+-]+\s+(?:at)\s+[a-z0-9.-]+(?:\s+dot\s+|\.)[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:gmail|yahoo|outlook|hotmail)\s*(?:dot|\.)\s*[a-z]{2,}\b/gi, "[email domain redacted]");
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
  const userTurns = normalized
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content)
    .map((content) => redactEmailLikeMemoryText(content))
    .filter((content) => content.length >= 18);

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

  return {
    summary: formatMemorySummarySections([
      ["Visitor/business context", businessContext],
      ["Primary goal", primaryGoal],
      ["Implementation notes", implementationNotes],
      ["Success or scale signals", successSignals],
      ["Next-step signals", nextStepSignals],
    ], userTurns),
    confidence: userTurns.length >= 3 ? 0.78 : 0.58,
    redacted_transcript_hash: sha256(JSON.stringify(normalized)),
  };
}

export function buildEmailMemoryRecordFromTranscript({ mapping, transcript, transcriptMetadata } = {}) {
  if (!mapping || typeof mapping !== "object") {
    throw new Error("conversation email mapping is required");
  }
  if (mapping.tenant_id !== DANI_TENANT_ID || mapping.agent_slug !== DANI_AGENT_SLUG) {
    throw new Error("conversation email mapping must be scoped to Dani");
  }

  const { summary, confidence, redacted_transcript_hash } = summarizeTranscriptForMemory(transcript);
  const summaryHash = hashSummary(summary);
  const recordSeed = [
    STORE_SCHEMA_VERSION,
    mapping.provider_conversation_id,
    mapping.session_id,
    summaryHash,
  ].join(":");
  const memoryRecordId = `hxemr_${sha256(recordSeed).slice(0, 16)}`;
  const memoryNamespace = `${mapping.visitor_memory_namespace}/${mapping.session_id}`;

  const recordWithoutHash = {
    schema_version: STORE_SCHEMA_VERSION,
    artifact_purpose: "xagent_email_identity_memory_record",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    visitor_id: mapping.visitor_id,
    visitor_memory_namespace: mapping.visitor_memory_namespace,
    memory_namespace: memoryNamespace,
    memory_record_id: memoryRecordId,
    memory_identity_type: "email_identity_hash",
    email_identity_hash: mapping.email_identity_hash,
    session_id: mapping.session_id,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: mapping.provider_conversation_id,
    recalled_memory_summary: summary,
    confidence,
    summary_hash: summaryHash,
    redacted_transcript_hash,
    tavus_transcript_metadata: transcriptMetadata ?? {},
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

export function buildSessionStartMemoryContextFromStoredRecord(record, options = {}) {
  if (!record || typeof record !== "object") {
    throw new Error("stored email memory record is required");
  }
  const nextSessionId = assertString(options.nextSessionId, "nextSessionId");
  const memoryContext = {
    artifact_purpose: "xagent_email_identity_next_session_context_from_store",
    xagent_memory_recall_preview_version: STORE_SCHEMA_VERSION,
    agent_slug: record.agent_slug,
    tenant_id: record.tenant_id,
    visitor_id: record.visitor_id,
    next_session_id: nextSessionId,
    prior_session_id: record.session_id,
    visitor_memory_namespace: record.visitor_memory_namespace,
    prior_memory_record_ids: [record.memory_record_id],
    recalled_memory_summary: record.recalled_memory_summary,
    confidence: record.confidence,
    provenance: {
      memory_record_id: record.memory_record_id,
      memory_namespace: record.memory_namespace,
      visitor_memory_namespace: record.visitor_memory_namespace,
      memory_type: "email_identity_memory_store_record",
      provider: record.provider,
      provider_conversation_id: record.provider_conversation_id,
      summary_hash: record.summary_hash,
      redacted_transcript_hash: record.redacted_transcript_hash,
      record_hash: record.record_hash,
      record_hash_verified: true,
      summary_hash_verified: true,
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
  await redisSet(latestMemoryKey(emailIdentityHash), record, options);
  return {
    memory_record_stored: true,
    memory_record_id: record.memory_record_id,
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
  if (!record) return null;

  return {
    lookup_source: "upstash_email_identity_memory_store",
    email_valid: true,
    email_identity_hash_derived: true,
    memory_context: buildSessionStartMemoryContextFromStoredRecord(record, {
      nextSessionId: input.nextSessionId,
    }),
  };
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
  await storeEmailMemoryRecord(record, options);

  return {
    memory_store_attempted: true,
    memory_record_stored: true,
    memory_store_status: "stored",
    memory_record_id: record.memory_record_id,
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
