import { createHash } from "crypto";
import { DANI_AGENT_SLUG, DANI_TENANT_ID, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const ADAPTER_VERSION = "phase_t2_xagent_website_t_dani_dry_run_v1";
const ALLOWED_OPERATIONS = ["summarize_session_for_memory"];
const SENSITIVE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\d[ -]*?){13,19}\b/g,
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
];

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function redactContent(content) {
  let redacted = content.replace(/\s+/g, " ").trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED_SENSITIVE]");
  }
  return redacted;
}

export function normalizeTranscriptTurns(transcript) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw new Error("transcript must include at least one turn");
  }

  return transcript.map((turn, index) => {
    if (!turn || typeof turn !== "object") {
      throw new Error(`transcript[${index}] must be an object`);
    }

    const role = assertString(turn.role, `transcript[${index}].role`).toLowerCase();
    if (role !== "user" && role !== "agent") {
      throw new Error(`transcript[${index}].role must be user or agent`);
    }

    const content = redactContent(assertString(turn.content, `transcript[${index}].content`));
    return { role, content };
  });
}

export function hashTranscript(transcript) {
  return createHash("sha256").update(JSON.stringify(transcript)).digest("hex");
}

export function buildSessionCompletedPayload(input) {
  const tenantId = assertString(input?.tenant_id, "tenant_id");
  const agentSlug = assertString(input?.agent_slug, "agent_slug");
  const visitorId = assertString(input?.visitor_id, "visitor_id");
  const sessionId = assertString(input?.session_id, "session_id");
  const provider = assertString(input?.provider, "provider");
  const providerConversationId = assertString(input?.provider_conversation_id, "provider_conversation_id");

  if (tenantId !== DANI_TENANT_ID) {
    throw new Error(`tenant_id must be ${DANI_TENANT_ID}`);
  }
  if (agentSlug !== DANI_AGENT_SLUG) {
    throw new Error("only agent_slug=dani is supported");
  }
  if (provider !== TAVUS_PROVIDER) {
    throw new Error("only provider=tavus is supported");
  }

  const transcript = normalizeTranscriptTurns(input.transcript);
  const transcriptHash = hashTranscript(transcript);
  const memoryNamespace = `xagents/${tenantId}/${agentSlug}/${visitorId}/${sessionId}`;
  const visitorMemoryNamespace = `xagents/${tenantId}/${agentSlug}/${visitorId}`;
  const completedAt = typeof input.completed_at === "string" && input.completed_at.trim()
    ? input.completed_at.trim()
    : new Date().toISOString();
  const idempotencyKey = [
    ADAPTER_VERSION,
    tenantId,
    agentSlug,
    visitorId,
    sessionId,
    provider,
    providerConversationId,
    ALLOWED_OPERATIONS[0],
    transcriptHash,
  ].join(":");

  return {
    artifact_purpose: "hermes_backend_payload_from_xagent_session_completed",
    adapter_version: ADAPTER_VERSION,
    event_type: "xagent.session.completed",
    tenant_id: tenantId,
    agent_slug: agentSlug,
    visitor_id: visitorId,
    session_id: sessionId,
    provider,
    provider_role: "provenance_only",
    provider_conversation_id: providerConversationId,
    provider_conversation_id_used_for_namespace: false,
    tavus_webhook_required: false,
    completed_at: completedAt,
    transcript,
    transcript_hash: transcriptHash,
    memory_namespace: memoryNamespace,
    visitor_memory_namespace: visitorMemoryNamespace,
    hermes_profile_name: "xagent-dani-backend",
    allowed_operations: [...ALLOWED_OPERATIONS],
    requested_operation: ALLOWED_OPERATIONS[0],
    operation_phase: "post_session",
    post_session_only: true,
    live_loop_dependency: false,
    model_policy: {
      default_lane: "disabled_dry_run_only",
      local_first: false,
      codex_openai_escalation: false,
      cloud_models_in_default_memory_loop: false,
      ollama_generate_called: false,
    },
    operator_review_policy: {
      required_for_contact_style_content: true,
      required_for_outbound_claims: true,
      required_before_next_session_replay: true,
    },
    action_claim_rule: "Hermes may create internal proof artifacts but may not claim outbound action happened.",
    idempotency_key: idempotencyKey,
    queue_policy: {
      queue_name: "hermes.backend.ai-fusion-labs.dani",
      dispatch_mode: "disabled_dry_run_only",
      does_not_block_live_tavus_turns: true,
      hermes_dispatched: false,
    },
    storage_policy: {
      store_redacted_summary_artifacts_only: true,
      raw_transcript_storage_owned_by_real_backend_policy: true,
      production_backend_mutated: false,
      production_memory_database_mutated: false,
      dry_run_preview_only: true,
    },
  };
}

export function buildDryRunResponse(input) {
  const hermes_backend_payload = buildSessionCompletedPayload(input);

  return {
    dry_run_only: true,
    internal_route_only: true,
    app_owned_event_ready: true,
    hermes_dispatched: false,
    outbound_action_taken: false,
    tavus_webhook_required: false,
    webhook_registered: false,
    live_hermes_called: false,
    codex_openai_escalation: false,
    ollama_generate_called: false,
    resend_called: false,
    production_backend_mutated: false,
    production_memory_database_mutated: false,
    hermes_backend_payload,
  };
}
