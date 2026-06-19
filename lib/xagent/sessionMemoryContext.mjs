import { createHash } from "crypto";
import { DANI_AGENT_SLUG, DANI_TENANT_ID } from "./sessionIdentity.mjs";

const MEMORY_CONTEXT_PREVIEW_VERSION = "phase_t12_session_start_memory_context_preview_v1";
const ENABLED_ENV = "XAGENT_MEMORY_CONTEXT_PREVIEW_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_MEMORY_CONTEXT_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_MEMORY_CONTEXT_KILL_SWITCH";
const SENSITIVE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\d[ -]*?){13,19}\b/g,
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
];
const OUTBOUND_CLAIM_PATTERNS = [
  /\b(?:email|message|text|sms|call|calendar invite|meeting|crm|workflow|follow-?up)\s+(?:was|has been)\s+(?:sent|scheduled|booked|created|updated|triggered|completed)\b/i,
  /\b(?:sent|scheduled|booked|created|updated|triggered|completed)\s+(?:an?\s+)?(?:email|message|text|sms|call|calendar invite|meeting|crm|workflow|follow-?up)\b/i,
  /\b(?:will|going to)\s+(?:send|schedule|book|create|update|trigger|complete)\s+(?:an?\s+)?(?:email|message|text|sms|call|calendar invite|meeting|crm|workflow|follow-?up)\b/i,
];
const FORBIDDEN_RAW_KEYS = new Set([
  "application.transcription_ready",
  "content",
  "messages",
  "raw_content",
  "raw_messages",
  "raw_tavus_payload",
  "raw_transcript",
  "redacted_memory_turns",
  "transcript",
  "transcript_turns",
  "turns",
]);
const DISALLOWED_TRUE_FLAGS = new Set([
  "application_transcription_ready_object_included",
  "hermes_dispatched",
  "hermes_execution_performed",
  "live_hermes_called",
  "live_tavus_called",
  "memory_updated",
  "outbound_action_taken",
  "production_backend_mutated",
  "production_database_mutated",
  "production_memory_database_mutated",
  "raw_tavus_payload_included",
  "raw_transcript_content_included",
  "redacted_turn_payload_written",
  "resend_called",
  "system_tool_turns_included",
]);

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function assertBoolean(value, expected, fieldName) {
  if (value !== expected) {
    throw new Error(`${fieldName} must be ${expected}`);
  }
}

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must include at least one item`);
  }
  return value.map((item, index) => assertString(item, `${fieldName}[${index}]`));
}

function rejectForbiddenKeys(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RAW_KEYS.has(key)) {
      throw new Error(`raw transcript/content/messages fields are not allowed at ${path}.${key}`);
    }
    rejectForbiddenKeys(child, `${path}.${key}`);
  }
}

function rejectDisallowedTrueFlags(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectDisallowedTrueFlags(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (DISALLOWED_TRUE_FLAGS.has(key) && child !== false) {
      throw new Error(`${path}.${key} must be false`);
    }
    rejectDisallowedTrueFlags(child, `${path}.${key}`);
  }
}

function rejectSensitiveOrOutboundSummary(summary) {
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(summary))) {
    throw new Error("recalled_memory_summary contains sensitive content");
  }
  if (OUTBOUND_CLAIM_PATTERNS.some((pattern) => pattern.test(summary))) {
    throw new Error("recalled_memory_summary contains outbound/action claims");
  }
}

function hashSummary(summary) {
  return createHash("sha256").update(String(summary ?? "").replace(/\s+/g, " ").trim()).digest("hex");
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

export function assertMemoryContextPreviewGates(overrides = {}) {
  const gates = readGateConfig(overrides);

  if (gates.enabled !== "true") {
    throw new Error(`${ENABLED_ENV} must be exactly true`);
  }
  if (gates.daniPilotEnabled !== "true") {
    throw new Error(`${DANI_PILOT_ENV} must be exactly true`);
  }
  if (gates.killSwitch !== "false") {
    throw new Error(`${KILL_SWITCH_ENV} must be exactly false`);
  }

  return gates;
}

export function validateSessionStartMemoryContext(input) {
  if (!input || typeof input !== "object") {
    throw new Error("memory context input is required");
  }
  rejectForbiddenKeys(input);
  rejectDisallowedTrueFlags(input);

  const agentSlug = assertString(input.agent_slug, "agent_slug");
  const tenantId = assertString(input.tenant_id, "tenant_id");
  const visitorId = assertString(input.visitor_id, "visitor_id");
  const visitorMemoryNamespace = assertString(input.visitor_memory_namespace, "visitor_memory_namespace");
  const nextSessionId = assertString(input.next_session_id, "next_session_id");
  const priorSessionId = typeof input.prior_session_id === "string" ? input.prior_session_id.trim() : "";
  const priorMemoryRecordIds = assertStringArray(input.prior_memory_record_ids, "prior_memory_record_ids");
  const recalledMemorySummary = assertString(input.recalled_memory_summary, "recalled_memory_summary");
  const confidence = Number(input.confidence);
  const provenance = input.provenance;

  if (agentSlug !== DANI_AGENT_SLUG) {
    throw new Error("agent_slug must be dani");
  }
  if (tenantId !== DANI_TENANT_ID) {
    throw new Error(`tenant_id must be ${DANI_TENANT_ID}`);
  }
  if (visitorMemoryNamespace !== `xagents/${tenantId}/${agentSlug}/${visitorId}`) {
    throw new Error("visitor_memory_namespace must match tenant, agent, and visitor");
  }
  if (priorSessionId && priorSessionId === nextSessionId) {
    throw new Error("next_session_id must differ from prior_session_id");
  }
  if (!Number.isFinite(confidence) || confidence <= 0) {
    throw new Error("confidence is required");
  }
  if (!provenance || typeof provenance !== "object") {
    throw new Error("provenance is required");
  }

  const summaryHash = assertString(provenance.summary_hash, "provenance.summary_hash");
  if (hashSummary(recalledMemorySummary) !== summaryHash) {
    throw new Error("provenance.summary_hash must match recalled_memory_summary");
  }
  assertString(provenance.record_hash, "provenance.record_hash");
  assertString(provenance.memory_record_id, "provenance.memory_record_id");
  assertString(provenance.memory_namespace, "provenance.memory_namespace");
  assertString(provenance.visitor_memory_namespace, "provenance.visitor_memory_namespace");
  if (provenance.visitor_memory_namespace !== visitorMemoryNamespace) {
    throw new Error("provenance.visitor_memory_namespace must match visitor_memory_namespace");
  }
  if (!priorMemoryRecordIds.includes(provenance.memory_record_id)) {
    throw new Error("provenance.memory_record_id must be included in prior_memory_record_ids");
  }
  assertBoolean(provenance.record_hash_verified, true, "provenance.record_hash_verified");
  assertBoolean(provenance.summary_hash_verified, true, "provenance.summary_hash_verified");

  rejectSensitiveOrOutboundSummary(recalledMemorySummary);
  const allowedUse = assertStringArray(input.allowed_use, "allowed_use");
  const forbiddenUse = assertStringArray(input.forbidden_use, "forbidden_use");

  return {
    agent_slug: agentSlug,
    tenant_id: tenantId,
    visitor_id: visitorId,
    next_session_id: nextSessionId,
    prior_session_id: priorSessionId || undefined,
    visitor_memory_namespace: visitorMemoryNamespace,
    prior_memory_record_ids: priorMemoryRecordIds,
    recalled_memory_summary: recalledMemorySummary,
    confidence,
    provenance: {
      ...provenance,
      summary_hash: summaryHash,
      record_hash: assertString(provenance.record_hash, "provenance.record_hash"),
      record_hash_verified: true,
      summary_hash_verified: true,
    },
    allowed_use: allowedUse,
    forbidden_use: forbiddenUse,
  };
}

export function buildSessionStartMemoryContextPreview(input) {
  const context = validateSessionStartMemoryContext(input);

  return {
    dry_run_only: true,
    internal_route_only: true,
    memory_context_preview_enabled: true,
    memory_context_preview_version: MEMORY_CONTEXT_PREVIEW_VERSION,
    agent_slug: context.agent_slug,
    tenant_id: context.tenant_id,
    visitor_id: context.visitor_id,
    next_session_id: context.next_session_id,
    prior_session_id: context.prior_session_id,
    visitor_memory_namespace: context.visitor_memory_namespace,
    prior_memory_record_ids: context.prior_memory_record_ids,
    recalled_memory_summary: context.recalled_memory_summary,
    confidence: context.confidence,
    allowed_use: context.allowed_use,
    forbidden_use: context.forbidden_use,
    provenance: context.provenance,
    tavus_prompt_injection_performed: false,
    tavus_persona_mutated: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    codex_openai_escalation: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    production_memory_database_mutated: false,
    outbound_action_taken: false,
  };
}

export function buildGatedSessionStartMemoryContextPreview(input, options = {}) {
  assertMemoryContextPreviewGates(options.env);
  return buildSessionStartMemoryContextPreview(input);
}
