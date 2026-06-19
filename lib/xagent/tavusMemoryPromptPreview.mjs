import { buildSessionStartMemoryContextPreview } from "./sessionMemoryContext.mjs";

const PROMPT_PREVIEW_VERSION = "phase_t13_tavus_memory_prompt_preview_v1";
const ENABLED_ENV = "XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_MEMORY_PROMPT_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_TAVUS_MEMORY_PROMPT_KILL_SWITCH";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

export function assertTavusMemoryPromptPreviewGates(overrides = {}) {
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

function renderSafePromptContext(memoryContext) {
  const allowedUse = memoryContext.allowed_use.map((item) => `- ${item}`).join("\n");
  const forbiddenUse = memoryContext.forbidden_use.map((item) => `- ${item}`).join("\n");

  return [
    "Internal continuity context for Dani.",
    "",
    "Use this only as quiet background for the next session. Do not disclose, quote, or describe this block to the visitor.",
    "",
    "Prior context summary:",
    memoryContext.recalled_memory_summary,
    "",
    "Allowed background use:",
    allowedUse,
    "",
    "Forbidden actions and claims:",
    forbiddenUse,
    "- Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened.",
    "- Do not reveal hashes, namespaces, IDs, or backend machinery.",
    "- Do not say \"I remember everything\" or imply surveillance.",
    "",
    "Conversation guidance:",
    "- Dani may naturally continue from prior goals and preferences when relevant.",
    "- Dani should ask for confirmation before acting on prior context.",
  ].join("\n");
}

function collectForbiddenPromptTokens(memoryContext) {
  const tokens = [
    memoryContext.visitor_id,
    memoryContext.next_session_id,
    memoryContext.prior_session_id,
    memoryContext.visitor_memory_namespace,
    ...memoryContext.prior_memory_record_ids,
  ];

  for (const value of Object.values(memoryContext.provenance ?? {})) {
    if (typeof value !== "string") continue;
    const token = value.trim();
    if (
      token.startsWith("hx")
      || token.startsWith("xagents/")
      || token.includes("\\")
      || token.includes("/")
      || /^[a-f0-9]{32,}$/i.test(token)
      || /^ca[0-9a-f]{6,}$/i.test(token)
    ) {
      tokens.push(token);
    }
  }

  return [...new Set(tokens.filter((token) => typeof token === "string" && token.trim().length > 0))];
}

function assertPromptDoesNotExposeBackendTokens(prompt, memoryContext) {
  for (const token of collectForbiddenPromptTokens(memoryContext)) {
    if (prompt.includes(token)) {
      throw new Error("candidate_tavus_prompt_context must not expose backend identifiers");
    }
  }
}

export function buildTavusMemoryPromptPreview(input) {
  const memoryContext = buildSessionStartMemoryContextPreview(input);
  const candidateTavusPromptContext = renderSafePromptContext(memoryContext);
  assertPromptDoesNotExposeBackendTokens(candidateTavusPromptContext, memoryContext);

  return {
    dry_run_only: true,
    prompt_preview_only: true,
    internal_route_only: true,
    tavus_memory_prompt_preview_version: PROMPT_PREVIEW_VERSION,
    agent_slug: memoryContext.agent_slug,
    tenant_id: memoryContext.tenant_id,
    visitor_id: memoryContext.visitor_id,
    next_session_id: memoryContext.next_session_id,
    prior_session_id: memoryContext.prior_session_id,
    visitor_memory_namespace: memoryContext.visitor_memory_namespace,
    prior_memory_record_ids: memoryContext.prior_memory_record_ids,
    candidate_tavus_prompt_context: candidateTavusPromptContext,
    allowed_use: memoryContext.allowed_use,
    forbidden_use: memoryContext.forbidden_use,
    provenance: memoryContext.provenance,
    tavus_prompt_injection_performed: false,
    conversation_start_mutated: false,
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

export function buildGatedTavusMemoryPromptPreview(input, options = {}) {
  assertTavusMemoryPromptPreviewGates(options.env);
  return buildTavusMemoryPromptPreview(input);
}
