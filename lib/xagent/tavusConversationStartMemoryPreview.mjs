import { buildTavusMemoryPromptPreview } from "./tavusMemoryPromptPreview.mjs";

const CONVERSATION_MEMORY_PAYLOAD_PREVIEW_VERSION = "phase_t15_tavus_conversation_memory_payload_preview_v1";
const ENABLED_ENV = "XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_MEMORY_PAYLOAD_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_TAVUS_MEMORY_PAYLOAD_KILL_SWITCH";
const DEFAULT_CUSTOM_GREETING = "Hey, welcome. I am Dani. Thanks for dropping in. What are you most curious about today.";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function numericEnv(key, fallback) {
  const parsed = Number(process.env[key] ?? fallback);
  return Number.isFinite(parsed) ? parsed : Number(fallback);
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

function readTavusConfig(overrides = {}) {
  return {
    personaId: overrides.personaId ?? env("TAVUS_PERSONA_ID"),
    replicaId: overrides.replicaId ?? env("TAVUS_REPLICA_ID"),
    maxCallSeconds: overrides.maxCallSeconds ?? numericEnv("DEMO_MAX_CALL_SECONDS", "720"),
    absentTimeout: overrides.absentTimeout ?? numericEnv("DEMO_PARTICIPANT_ABSENT_TIMEOUT", "30"),
    leftTimeout: overrides.leftTimeout ?? numericEnv("DEMO_PARTICIPANT_LEFT_TIMEOUT", "5"),
  };
}

export function assertTavusConversationMemoryPayloadPreviewGates(overrides = {}) {
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

function buildCurrentCreateConversationBodyShape(options = {}) {
  const tavusConfig = readTavusConfig(options.tavusConfig);
  const body = {
    persona_id: tavusConfig.personaId,
    replica_id: tavusConfig.replicaId,
    custom_greeting: DEFAULT_CUSTOM_GREETING,
    properties: {
      max_call_duration: tavusConfig.maxCallSeconds,
      participant_absent_timeout: tavusConfig.absentTimeout,
      participant_left_timeout: tavusConfig.leftTimeout,
    },
  };

  if (typeof options.callbackUrl === "string" && options.callbackUrl.trim().length > 0) {
    body.callback_url = options.callbackUrl.trim();
  }

  return body;
}

export function buildTavusConversationStartMemoryPayloadPreview(input, options = {}) {
  const promptPreview = buildTavusMemoryPromptPreview(input);
  const baseCreateConversationBody = buildCurrentCreateConversationBodyShape(options);

  return {
    dry_run_only: true,
    payload_preview_only: true,
    internal_route_only: true,
    tavus_conversation_memory_payload_preview_version: CONVERSATION_MEMORY_PAYLOAD_PREVIEW_VERSION,
    agent_slug: promptPreview.agent_slug,
    tenant_id: promptPreview.tenant_id,
    visitor_id: promptPreview.visitor_id,
    next_session_id: promptPreview.next_session_id,
    prior_session_id: promptPreview.prior_session_id,
    visitor_memory_namespace: promptPreview.visitor_memory_namespace,
    prior_memory_record_ids: promptPreview.prior_memory_record_ids,
    candidate_tavus_prompt_context: promptPreview.candidate_tavus_prompt_context,
    candidate_create_conversation_body_preview: {
      ...baseCreateConversationBody,
      conversational_context: promptPreview.candidate_tavus_prompt_context,
    },
    memory_attachment_strategy: "official_conversational_context_preview",
    tavus_official_memory_field_verified: true,
    tavus_create_conversation_called: false,
    conversation_start_route_mutated: false,
    tavus_prompt_injection_performed: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    codex_openai_escalation: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    production_memory_database_mutated: false,
    outbound_action_taken: false,
    allowed_use: promptPreview.allowed_use,
    forbidden_use: promptPreview.forbidden_use,
    provenance: promptPreview.provenance,
  };
}

export function buildGatedTavusConversationStartMemoryPayloadPreview(input, options = {}) {
  assertTavusConversationMemoryPayloadPreviewGates(options.env);
  return buildTavusConversationStartMemoryPayloadPreview(input, options);
}
