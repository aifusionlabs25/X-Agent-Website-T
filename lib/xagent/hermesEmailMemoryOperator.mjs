import {
  buildEmailMemoryRecordFromSummary,
  readConversationEmailMapping,
  storeEmailMemoryRecord,
  summarizeTranscriptForMemory,
} from "./emailMemoryStore.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const OPERATOR_VERSION = "t45_hermes_email_memory_operator_v1";
const ENABLED_ENV = "XAGENT_HERMES_MEMORY_OPERATOR_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH";
const MODE_ENV = "XAGENT_HERMES_MEMORY_OPERATOR_MODE";
const GATEWAY_URL_ENV = "XAGENT_HERMES_GATEWAY_URL";
const GATEWAY_TOKEN_ENV = "XAGENT_HERMES_GATEWAY_TOKEN";
const GATEWAY_TIMEOUT_MS_ENV = "XAGENT_HERMES_GATEWAY_TIMEOUT_MS";
const EMBEDDED_MODE = "embedded";
const GATEWAY_MODE = "gateway";

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function readGateConfig(overrides = {}) {
  return {
    enabled: env(ENABLED_ENV, overrides),
    daniPilotEnabled: env(DANI_PILOT_ENV, overrides),
    killSwitch: env(KILL_SWITCH_ENV, overrides),
  };
}

export function areHermesMemoryOperatorGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function readHermesMemoryOperatorMode(overrides = {}) {
  const configuredMode = env(MODE_ENV, overrides);
  const mode = (configuredMode || EMBEDDED_MODE).toLowerCase();
  if (mode !== EMBEDDED_MODE && mode !== GATEWAY_MODE) {
    throw new Error(`${MODE_ENV} must be embedded or gateway`);
  }
  return mode;
}

function buildOperatorRequest({ mapping, transcript, transcriptMetadata } = {}) {
  return {
    operator_version: OPERATOR_VERSION,
    event_type: "xagent.session.completed",
    requested_operation: "summarize_session_for_memory",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: mapping.provider_conversation_id,
    session_id: mapping.session_id,
    visitor_id: mapping.visitor_id,
    visitor_memory_namespace: mapping.visitor_memory_namespace,
    memory_identity_type: "email_identity_hash",
    email_identity_hash_present: Boolean(mapping.email_identity_hash),
    transcript,
    transcript_metadata: transcriptMetadata ?? {},
    policies: {
      post_session_only: true,
      live_turn_loop_dependency: false,
      summarize_session_for_memory_only: true,
      raw_email_available_to_operator: false,
      raw_email_must_not_be_returned: true,
      raw_transcript_may_be_processed_for_summary: true,
      raw_transcript_must_not_be_stored: true,
      outbound_action_allowed: false,
      outbound_completion_claim_allowed_without_tool_confirmation: false,
    },
  };
}

function assertGatewaySummaryResponse(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Hermes gateway response must be an object");
  }
  return {
    summary: assertString(value.summary ?? value.recalled_memory_summary, "Hermes gateway summary"),
    confidence: Number(value.confidence ?? 0.72),
    redacted_transcript_hash: assertString(value.redacted_transcript_hash, "Hermes gateway redacted_transcript_hash"),
    operator_metadata: value.operator_metadata && typeof value.operator_metadata === "object"
      ? value.operator_metadata
      : {},
  };
}

async function runEmbeddedHermesOperator(operatorRequest) {
  const summary = summarizeTranscriptForMemory(operatorRequest.transcript);
  return {
    ...summary,
    operator_metadata: {
      hermes_operator_version: OPERATOR_VERSION,
      hermes_operator_mode: EMBEDDED_MODE,
      hermes_operator_invoked: true,
      hermes_gateway_called: false,
      local_embedded_operator_used: true,
      requested_operation: operatorRequest.requested_operation,
      post_session_only: true,
      live_turn_loop_dependency: false,
    },
  };
}

async function runGatewayHermesOperator(operatorRequest, options = {}) {
  const envSource = options.env ?? process.env;
  const gatewayUrl = assertString(options.gatewayUrl ?? env(GATEWAY_URL_ENV, envSource), GATEWAY_URL_ENV);
  const gatewayToken = assertString(options.gatewayToken ?? env(GATEWAY_TOKEN_ENV, envSource), GATEWAY_TOKEN_ENV);
  const configuredTimeoutMs = options.gatewayTimeoutMs ?? env(GATEWAY_TIMEOUT_MS_ENV, envSource);
  const timeoutMs = Number(configuredTimeoutMs || 12000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`${GATEWAY_TIMEOUT_MS_ENV} must be a positive number`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(gatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(operatorRequest),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = typeof response.text === "function" ? await response.text() : "";
      throw new Error(`Hermes gateway failed: ${response.status} ${text}`.trim());
    }

    const parsed = assertGatewaySummaryResponse(await response.json());
    return {
      ...parsed,
      operator_metadata: {
        ...parsed.operator_metadata,
        hermes_operator_version: OPERATOR_VERSION,
        hermes_operator_mode: GATEWAY_MODE,
        hermes_operator_invoked: true,
        hermes_gateway_called: true,
        local_embedded_operator_used: false,
        requested_operation: operatorRequest.requested_operation,
        post_session_only: true,
        live_turn_loop_dependency: false,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runHermesEmailMemoryOperator({ provider_conversation_id, transcript, transcriptMetadata } = {}, options = {}) {
  const envSource = options.env ?? process.env;
  const providerConversationId = assertString(provider_conversation_id, "provider_conversation_id");
  const enabled = areHermesMemoryOperatorGatesOpen(envSource);
  const mapping = await readConversationEmailMapping(providerConversationId, options);

  if (!mapping) {
    return {
      hermes_operator_attempted: true,
      hermes_operator_invoked: false,
      memory_store_attempted: true,
      memory_record_stored: false,
      memory_store_status: "conversation_email_mapping_not_found",
      provider_conversation_id: providerConversationId,
    };
  }

  if (!enabled) {
    const fallback = await runEmbeddedHermesOperator(buildOperatorRequest({
      mapping,
      transcript,
      transcriptMetadata,
    }));
    const record = buildEmailMemoryRecordFromSummary({
      mapping,
      summary: fallback.summary,
      confidence: fallback.confidence,
      redacted_transcript_hash: fallback.redacted_transcript_hash,
      transcriptMetadata,
      operatorMetadata: {
        ...fallback.operator_metadata,
        hermes_operator_gates_open: false,
        hermes_operator_invoked: false,
        hermes_gateway_called: false,
        hermes_operator_status: "embedded_fallback_because_gates_closed",
      },
    });
    const storeResult = await storeEmailMemoryRecord(record, options);
    return {
      hermes_operator_attempted: true,
      hermes_operator_invoked: false,
      hermes_operator_mode: EMBEDDED_MODE,
      hermes_operator_status: "embedded_fallback_because_gates_closed",
      hermes_gateway_called: false,
      memory_store_attempted: true,
      memory_record_stored: storeResult.memory_record_stored,
      memory_store_status: "stored",
      memory_record_id: record.memory_record_id,
      provider_conversation_id: providerConversationId,
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

  const operatorRequest = buildOperatorRequest({
    mapping,
    transcript,
    transcriptMetadata,
  });
  const mode = readHermesMemoryOperatorMode(envSource);
  const operatorResult = mode === GATEWAY_MODE
    ? await runGatewayHermesOperator(operatorRequest, options)
    : await runEmbeddedHermesOperator(operatorRequest);
  const record = buildEmailMemoryRecordFromSummary({
    mapping,
    summary: operatorResult.summary,
    confidence: operatorResult.confidence,
    redacted_transcript_hash: operatorResult.redacted_transcript_hash,
    transcriptMetadata,
    operatorMetadata: {
      ...operatorResult.operator_metadata,
      hermes_operator_gates_open: true,
      hermes_operator_status: "completed",
    },
  });
  const storeResult = await storeEmailMemoryRecord(record, options);

  return {
    hermes_operator_attempted: true,
    hermes_operator_invoked: true,
    hermes_operator_mode: mode,
    hermes_operator_status: "completed",
    hermes_gateway_called: mode === GATEWAY_MODE,
    memory_store_attempted: true,
    memory_record_stored: storeResult.memory_record_stored,
    memory_store_status: "stored",
    memory_record_id: record.memory_record_id,
    provider_conversation_id: providerConversationId,
    raw_email_stored: false,
    normalized_email_stored: false,
    raw_transcript_stored: false,
    live_hermes_called: mode === GATEWAY_MODE,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    outbound_action_taken: false,
    production_memory_database_mutated: true,
  };
}

export const HERMES_EMAIL_MEMORY_OPERATOR_VERSION = OPERATOR_VERSION;
