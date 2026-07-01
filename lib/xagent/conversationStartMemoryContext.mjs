import { buildTavusMemoryPromptPreview } from "./tavusMemoryPromptPreview.mjs";

const ENABLED_ENV = "XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH";

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

export function areConversationStartMemoryContextGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

function extractMemoryContextPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  if (body.memory_context && typeof body.memory_context === "object") {
    return body.memory_context;
  }
  if (body.memoryContext && typeof body.memoryContext === "object") {
    return body.memoryContext;
  }
  if (
    body.agent_slug
    || body.recalled_memory_summary
    || body.prior_memory_record_ids
    || body.provenance
  ) {
    return body;
  }
  return undefined;
}

export function hasSuppliedConversationStartMemoryContext(body) {
  return Boolean(extractMemoryContextPayload(body));
}

export function buildNoMemoryConversationStartContext() {
  return {
    memory_context_requested: false,
    memory_context_applied: false,
    tavus_conversational_context_attached: false,
    conversationalContext: undefined,
  };
}

export function buildInvalidMemoryContextValidationResponse() {
  return {
    memory_context_requested: true,
    memory_context_applied: false,
    tavus_conversational_context_attached: false,
    tavus_create_conversation_called: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    outbound_action_taken: false,
  };
}

export function buildConversationStartMemoryContextForRequestBody(body, options = {}) {
  const suppliedMemoryContext = extractMemoryContextPayload(body);
  const memoryContextRequested = Boolean(suppliedMemoryContext);

  if (!areConversationStartMemoryContextGatesOpen(options.env)) {
    return buildNoMemoryConversationStartContext();
  }
  if (!memoryContextRequested) {
    return buildNoMemoryConversationStartContext();
  }

  const promptPreview = buildTavusMemoryPromptPreview(suppliedMemoryContext, options);

  return {
    memory_context_requested: true,
    memory_context_applied: true,
    tavus_conversational_context_attached: true,
    conversationalContext: promptPreview.candidate_tavus_prompt_context,
  };
}

export function safeConversationStartMemoryFlags(memoryContextResult) {
  return {
    memory_context_requested: Boolean(memoryContextResult?.memory_context_requested),
    memory_context_applied: Boolean(memoryContextResult?.memory_context_applied),
    tavus_conversational_context_attached: Boolean(memoryContextResult?.tavus_conversational_context_attached),
  };
}

export async function readOptionalJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}
