import { createHash } from "crypto";
import fixture from "../../tests/fixtures/hermes-email-memory-lookup-dani.json" with { type: "json" };
import { buildSessionStartMemoryContextPreview } from "./sessionMemoryContext.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID } from "./sessionIdentity.mjs";

const ENABLED_ENV = "XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH";
const DEFAULT_FIXTURE_SALT = "h-email-2-fixture-only-non-production-salt";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_FIXTURE_KEYS = new Set([
  "content",
  "messages",
  "normalized_email",
  "normalized_email_fixture_only",
  "prompt",
  "prompt_text",
  "raw_email",
  "raw_messages",
  "raw_transcript",
  "transcript",
]);

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function rejectForbiddenFixtureKeys(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectForbiddenFixtureKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIXTURE_KEYS.has(key)) {
      throw new Error(`email lookup fixture must not include ${path}.${key}`);
    }
    rejectForbiddenFixtureKeys(child, `${path}.${key}`);
  }
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

export function areEmailMemoryLookupGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function assertEmailMemoryLookupGates(overrides = {}) {
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

export function normalizeEmailIdentityInput(value) {
  const email = assertString(value, "email").trim().toLowerCase();
  const atCount = [...email].filter((char) => char === "@").length;
  if (atCount !== 1 || !EMAIL_SHAPE.test(email)) {
    throw new Error("email must use a basic valid email shape");
  }
  return email;
}

export function isBasicEmailIdentityShape(value) {
  try {
    normalizeEmailIdentityInput(value);
    return true;
  } catch {
    return false;
  }
}

export function deriveEmailIdentityHash({
  identitySalt = DEFAULT_FIXTURE_SALT,
  tenantId = DANI_TENANT_ID,
  agentSlug = DANI_AGENT_SLUG,
  normalizedEmail,
} = {}) {
  const normalized = normalizeEmailIdentityInput(normalizedEmail);
  return createHash("sha256")
    .update(`${identitySalt}:${tenantId}:${agentSlug}:${normalized}`)
    .digest("hex");
}

export function loadEmailMemoryLookupFixture(options = {}) {
  return clone(options.fixture ?? fixture);
}

function validateEmailMemoryLookupFixture(record) {
  if (!record || typeof record !== "object") {
    throw new Error("email memory lookup fixture is required");
  }
  rejectForbiddenFixtureKeys(record);

  if (record.agent_slug !== DANI_AGENT_SLUG) {
    throw new Error("email memory lookup fixture agent_slug must be dani");
  }
  if (record.tenant_id !== DANI_TENANT_ID) {
    throw new Error(`email memory lookup fixture tenant_id must be ${DANI_TENANT_ID}`);
  }
  if (record.local_fixture_only !== true) {
    throw new Error("email memory lookup fixture must be local_fixture_only");
  }
  if (record.memory_identity_type !== "email_identity_hash") {
    throw new Error("email memory lookup fixture memory_identity_type must be email_identity_hash");
  }
  assertString(record.email_identity_hash, "email_identity_hash");
  assertString(record.identity_salt_fixture_only, "identity_salt_fixture_only");
  if (record.production_database_mutated !== false || record.production_memory_database_mutated !== false) {
    throw new Error("email memory lookup fixture production mutation flags must be false");
  }
  if (record.live_tavus_called !== false || record.live_hermes_called !== false) {
    throw new Error("email memory lookup fixture live-call flags must be false");
  }
  if (record.openai_called !== false || record.ollama_generate_called !== false) {
    throw new Error("email memory lookup fixture model-call flags must be false");
  }
  if (record.resend_called !== false || record.outbound_action_taken !== false) {
    throw new Error("email memory lookup fixture outbound flags must be false");
  }

  buildSessionStartMemoryContextPreview(record.memory_context);
  return record;
}

function getEmailInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  if (typeof input.email === "string" && input.email.trim()) {
    return input.email;
  }
  if (typeof input.emailAddress === "string" && input.emailAddress.trim()) {
    return input.emailAddress;
  }
  return undefined;
}

export function resolveEmailMemoryContext(input, options = {}) {
  const normalizedEmail = normalizeEmailIdentityInput(getEmailInput(input));
  const record = validateEmailMemoryLookupFixture(loadEmailMemoryLookupFixture(options));
  const emailIdentityHash = deriveEmailIdentityHash({
    identitySalt: options.identitySalt ?? record.identity_salt_fixture_only,
    tenantId: record.tenant_id,
    agentSlug: record.agent_slug,
    normalizedEmail,
  });

  if (emailIdentityHash !== record.email_identity_hash) {
    throw new Error("email identity was not found in the local Dani proof-store fixture");
  }

  const memoryContext = clone(record.memory_context);
  const sessionStartMemoryContextPreview = buildSessionStartMemoryContextPreview(memoryContext);

  return {
    email_valid: true,
    email_identity_hash_derived: true,
    agent_slug: DANI_AGENT_SLUG,
    tenant_id: DANI_TENANT_ID,
    lookup_source: "local_email_identity_fixture_proof_store",
    local_fixture_only: true,
    memory_context: memoryContext,
    session_start_memory_context_preview: sessionStartMemoryContextPreview,
  };
}

function safeBaseResponse(overrides = {}) {
  return {
    dry_run_only: true,
    internal_route_only: true,
    email_memory_lookup_preview_enabled: Boolean(overrides.email_memory_lookup_preview_enabled),
    email_supplied: Boolean(overrides.email_supplied),
    email_valid: Boolean(overrides.email_valid),
    email_identity_hash_derived: Boolean(overrides.email_identity_hash_derived),
    agent_slug: DANI_AGENT_SLUG,
    tenant_id: DANI_TENANT_ID,
    memory_context_preview_available: Boolean(overrides.memory_context_preview_available),
    server_side_memory_context_applied: false,
    memory_context_applied: false,
    tavus_prompt_injection_performed: false,
    tavus_create_conversation_called: false,
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

export function buildSafeEmailMemoryLookupUnavailableResponse(input = {}, options = {}) {
  return safeBaseResponse({
    email_memory_lookup_preview_enabled: Boolean(options.emailMemoryLookupPreviewEnabled),
    email_supplied: Boolean(getEmailInput(input)),
    email_valid: false,
    email_identity_hash_derived: false,
    memory_context_preview_available: false,
  });
}

export function buildEmailMemoryLookupDryRunResponse(input, options = {}) {
  resolveEmailMemoryContext(input, options);
  return {
    ...safeBaseResponse({
      email_memory_lookup_preview_enabled: true,
      email_supplied: true,
      email_valid: true,
      email_identity_hash_derived: true,
      memory_context_preview_available: true,
    }),
    lookup_source: "local_email_identity_fixture_proof_store",
    local_fixture_only: true,
  };
}

export function buildGatedEmailMemoryLookupDryRunResponse(input, options = {}) {
  assertEmailMemoryLookupGates(options.env);
  return buildEmailMemoryLookupDryRunResponse(input, options);
}
