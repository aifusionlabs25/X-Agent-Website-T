import { randomInt } from "crypto";
import fixture from "../../tests/fixtures/hermes-return-code-memory-lookup-dani.json" with { type: "json" };
import { buildSessionStartMemoryContextPreview } from "./sessionMemoryContext.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID } from "./sessionIdentity.mjs";

const ENABLED_ENV = "XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH";
const RETURN_CODE_PREFIX = "DANI-RET";
const RETURN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

export function areReturnCodeMemoryLookupGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function assertReturnCodeMemoryLookupGates(overrides = {}) {
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

export function generateDaniReturnCode(options = {}) {
  const randomIntImpl = options.randomIntImpl ?? randomInt;
  let code = "";
  for (let index = 0; index < 12; index += 1) {
    code += RETURN_CODE_ALPHABET[randomIntImpl(RETURN_CODE_ALPHABET.length)];
  }
  return `${RETURN_CODE_PREFIX}-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function normalizeDaniReturnCode(value) {
  const raw = assertString(value, "return_code").toUpperCase();
  const compact = raw.replace(/[\s-]/g, "");
  const expectedPrefix = RETURN_CODE_PREFIX.replace("-", "");

  if (!compact.startsWith(expectedPrefix)) {
    throw new Error(`return_code must use ${RETURN_CODE_PREFIX}-XXXX-XXXX-XXXX format`);
  }

  const code = compact.slice(expectedPrefix.length);
  if (code.length !== 12) {
    throw new Error(`return_code must use ${RETURN_CODE_PREFIX}-XXXX-XXXX-XXXX format`);
  }

  for (const char of code) {
    if (!RETURN_CODE_ALPHABET.includes(char)) {
      throw new Error("return_code contains unsupported characters");
    }
  }

  return `${RETURN_CODE_PREFIX}-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function isDaniReturnCodeShape(value) {
  try {
    normalizeDaniReturnCode(value);
    return true;
  } catch {
    return false;
  }
}

export function loadReturnCodeMemoryLookupFixture(options = {}) {
  return clone(options.fixture ?? fixture);
}

function validateReturnCodeMemoryLookupFixture(record) {
  if (!record || typeof record !== "object") {
    throw new Error("return-code lookup fixture is required");
  }
  if (record.agent_slug !== DANI_AGENT_SLUG) {
    throw new Error("return-code lookup fixture agent_slug must be dani");
  }
  if (record.tenant_id !== DANI_TENANT_ID) {
    throw new Error(`return-code lookup fixture tenant_id must be ${DANI_TENANT_ID}`);
  }
  if (record.local_fixture_only !== true) {
    throw new Error("return-code lookup fixture must be local_fixture_only");
  }
  if (record.production_database_mutated !== false) {
    throw new Error("return-code lookup fixture production_database_mutated must be false");
  }
  if (record.live_tavus_called !== false || record.live_hermes_called !== false) {
    throw new Error("return-code lookup fixture live-call flags must be false");
  }
  if (record.openai_called !== false || record.ollama_generate_called !== false) {
    throw new Error("return-code lookup fixture model-call flags must be false");
  }
  if (record.resend_called !== false || record.outbound_action_taken !== false) {
    throw new Error("return-code lookup fixture outbound flags must be false");
  }

  normalizeDaniReturnCode(record.return_code);
  buildSessionStartMemoryContextPreview(record.memory_context);
  return record;
}

export function resolveReturnCodeMemoryContext(input, options = {}) {
  const normalizedReturnCode = normalizeDaniReturnCode(input?.return_code ?? input?.returnCode);
  const record = validateReturnCodeMemoryLookupFixture(loadReturnCodeMemoryLookupFixture(options));
  const fixtureReturnCode = normalizeDaniReturnCode(record.return_code);

  if (normalizedReturnCode !== fixtureReturnCode) {
    throw new Error("return_code was not found in the local Dani proof-store fixture");
  }

  const memoryContext = clone(record.memory_context);
  const sessionStartMemoryContextPreview = buildSessionStartMemoryContextPreview(memoryContext);

  return {
    return_code_valid: true,
    agent_slug: DANI_AGENT_SLUG,
    tenant_id: DANI_TENANT_ID,
    lookup_source: "local_fixture_proof_store",
    local_fixture_only: true,
    memory_context: memoryContext,
    session_start_memory_context_preview: sessionStartMemoryContextPreview,
  };
}

function safeBaseResponse(overrides = {}) {
  return {
    dry_run_only: true,
    internal_route_only: true,
    return_code_lookup_preview_enabled: Boolean(overrides.return_code_lookup_preview_enabled),
    return_code_valid: Boolean(overrides.return_code_valid),
    agent_slug: DANI_AGENT_SLUG,
    tenant_id: DANI_TENANT_ID,
    memory_context_preview_available: Boolean(overrides.memory_context_preview_available),
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

export function buildSafeReturnCodeMemoryLookupUnavailableResponse(options = {}) {
  return safeBaseResponse({
    return_code_lookup_preview_enabled: Boolean(options.returnCodeLookupPreviewEnabled),
    return_code_valid: false,
    memory_context_preview_available: false,
  });
}

export function buildReturnCodeMemoryLookupDryRunResponse(input, options = {}) {
  resolveReturnCodeMemoryContext(input, options);
  return {
    ...safeBaseResponse({
      return_code_lookup_preview_enabled: true,
      return_code_valid: true,
      memory_context_preview_available: true,
    }),
    lookup_source: "local_fixture_proof_store",
    local_fixture_only: true,
  };
}

export function buildGatedReturnCodeMemoryLookupDryRunResponse(input, options = {}) {
  assertReturnCodeMemoryLookupGates(options.env);
  return buildReturnCodeMemoryLookupDryRunResponse(input, options);
}
