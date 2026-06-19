import { buildCreateConversationBody } from "../tavusCreateConversationBody.mjs";
import { areConversationStartMemoryContextGatesOpen } from "./conversationStartMemoryContext.mjs";

export const XAGENT_RUNTIME_READINESS_VERSION = "phase_t20_1_runtime_readiness_v1";

const DIAGNOSTIC_TAVUS_CONFIG = {
  personaId: "diagnostic_persona_placeholder",
  replicaId: "diagnostic_replica_placeholder",
  maxCallSeconds: 1,
  absentTimeout: 1,
  leftTimeout: 1,
};

function timestamp(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isNaN(value.valueOf()) ? new Date(0).toISOString() : value.toISOString();
}

export function buildXAgentRuntimeReadiness(options = {}) {
  const env = options.env ?? process.env;
  const diagnosticBody = buildCreateConversationBody(DIAGNOSTIC_TAVUS_CONFIG, {
    conversationalContext: "diagnostic_context_supported",
  });

  return {
    runtime_readiness_version: XAGENT_RUNTIME_READINESS_VERSION,
    checked_at: timestamp(options.now),
    xagent_session_identity_supported: true,
    memory_context_injection_code_present: true,
    tavus_conversational_context_supported: diagnosticBody.conversational_context === "diagnostic_context_supported",
    memory_context_env_gates_open: areConversationStartMemoryContextGatesOpen(env),
    normal_customer_button_changed: false,
    tavus_create_conversation_called: false,
    tavus_conversation_created: false,
    tavus_room_joined: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    production_memory_persistence_used: false,
    outbound_action_taken: false,
    secrets_included: false,
    memory_summary_included: false,
    prompt_text_included: false,
    hashes_included: false,
    namespaces_included: false,
    backend_ids_included: false,
    transcript_content_messages_included: false,
  };
}
