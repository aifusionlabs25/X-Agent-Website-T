import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const HANDOFF_VERSION = "phase_t11_local_job_file_handoff_v1";
const JOB_TYPE = "xagent.session.completed.summarize_session_for_memory";
const DISPATCH_MODE = "disabled_local_file_handoff";
const REQUIRED_OPERATION = "summarize_session_for_memory";

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

function assertExactAllowedOperations(value) {
  if (
    !Array.isArray(value)
    || value.length !== 1
    || value[0] !== REQUIRED_OPERATION
  ) {
    throw new Error(`allowed_operations must be exactly ["${REQUIRED_OPERATION}"]`);
  }
}

function readGateConfig(overrides = {}) {
  return {
    dispatchEnabled: overrides.XAGENT_HERMES_DISPATCH_ENABLED ?? env("XAGENT_HERMES_DISPATCH_ENABLED"),
    daniPilotEnabled: overrides.XAGENT_HERMES_DANI_PILOT_ENABLED ?? env("XAGENT_HERMES_DANI_PILOT_ENABLED"),
    killSwitch: overrides.XAGENT_HERMES_DISPATCH_KILL_SWITCH ?? env("XAGENT_HERMES_DISPATCH_KILL_SWITCH"),
    outboxDir: overrides.XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR ?? env("XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR"),
  };
}

export function assertHermesLocalHandoffGates(overrides = {}) {
  const gates = readGateConfig(overrides);

  if (gates.dispatchEnabled !== "true") {
    throw new Error("XAGENT_HERMES_DISPATCH_ENABLED must be exactly true");
  }
  if (gates.daniPilotEnabled !== "true") {
    throw new Error("XAGENT_HERMES_DANI_PILOT_ENABLED must be exactly true");
  }
  if (gates.killSwitch !== "false") {
    throw new Error("XAGENT_HERMES_DISPATCH_KILL_SWITCH must be exactly false");
  }

  return {
    outboxDir: assertString(gates.outboxDir, "XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR"),
  };
}

export function validateHermesDispatchPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("hermes_backend_payload is required");
  }

  if (payload.event_type !== "xagent.session.completed") {
    throw new Error("event_type must be xagent.session.completed");
  }
  if (payload.agent_slug !== "dani") {
    throw new Error("agent_slug must be dani");
  }
  if (payload.provider !== "tavus") {
    throw new Error("provider must be tavus");
  }
  assertExactAllowedOperations(payload.allowed_operations);
  if (payload.requested_operation !== REQUIRED_OPERATION) {
    throw new Error(`requested_operation must be ${REQUIRED_OPERATION}`);
  }
  if (payload.operation_phase !== "post_session") {
    throw new Error("operation_phase must be post_session");
  }
  assertBoolean(payload.post_session_only, true, "post_session_only");
  assertBoolean(payload.live_loop_dependency, false, "live_loop_dependency");
  assertBoolean(payload.provider_conversation_id_used_for_namespace, false, "provider_conversation_id_used_for_namespace");

  assertString(payload.tenant_id, "tenant_id");
  assertString(payload.visitor_id, "visitor_id");
  assertString(payload.session_id, "session_id");
  assertString(payload.provider_conversation_id, "provider_conversation_id");
  assertString(payload.transcript_hash, "transcript_hash");
  assertString(payload.memory_namespace, "memory_namespace");
  assertString(payload.visitor_memory_namespace, "visitor_memory_namespace");
  assertString(payload.idempotency_key, "idempotency_key");

  return payload;
}

export function buildHermesLocalJobFile(payload, options = {}) {
  const validPayload = validateHermesDispatchPayload(payload);
  const sourceProofPath = typeof options.sourceProofPath === "string" && options.sourceProofPath.trim()
    ? options.sourceProofPath.trim()
    : undefined;

  return {
    handoff_version: HANDOFF_VERSION,
    job_type: JOB_TYPE,
    dispatch_mode: DISPATCH_MODE,
    event_type: validPayload.event_type,
    tenant_id: validPayload.tenant_id,
    agent_slug: validPayload.agent_slug,
    visitor_id: validPayload.visitor_id,
    session_id: validPayload.session_id,
    provider: validPayload.provider,
    provider_conversation_id: validPayload.provider_conversation_id,
    provider_conversation_id_used_for_namespace: validPayload.provider_conversation_id_used_for_namespace,
    transcript_hash: validPayload.transcript_hash,
    memory_namespace: validPayload.memory_namespace,
    visitor_memory_namespace: validPayload.visitor_memory_namespace,
    idempotency_key: validPayload.idempotency_key,
    allowed_operations: [...validPayload.allowed_operations],
    operator_review_required: true,
    source_proof_path: sourceProofPath,
    raw_transcript_included: false,
    hermes_dispatched: false,
    live_hermes_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
    codex_openai_escalation: false,
    ollama_generate_called: false,
    resend_called: false,
  };
}

export function deterministicJobFilename(payload) {
  const idempotencyKey = assertString(payload?.idempotency_key, "idempotency_key");
  const digest = createHash("sha256").update(idempotencyKey).digest("hex");
  return `${JOB_TYPE}.${digest}.json`;
}

export async function writeHermesLocalJobFile(payload, options = {}) {
  const { outboxDir } = assertHermesLocalHandoffGates(options.env);
  const job = buildHermesLocalJobFile(payload, {
    sourceProofPath: options.sourceProofPath,
  });
  const filename = deterministicJobFilename(payload);
  const path = join(outboxDir, filename);
  const serialized = `${JSON.stringify(job, null, 2)}\n`;

  await mkdir(outboxDir, { recursive: true });
  await writeFile(path, serialized, "utf8");

  return {
    local_job_file_written: true,
    local_job_file_path: path,
    hermes_dispatched: false,
    live_hermes_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
    job,
  };
}
