import { buildCreateConversationBody } from "../tavusCreateConversationBody.mjs";
import { buildAgentMailAdapterReadiness } from "./agentMailAdapterReadiness.mjs";
import { buildAgentMailSendAdapterReadiness } from "./agentMailSendAdapter.mjs";
import { areConversationStartMemoryContextGatesOpen } from "./conversationStartMemoryContext.mjs";
import { areEmailOutboundContactStoreGatesOpen } from "./emailMemoryStore.mjs";
import {
  areHermesEmailActionGatesOpen,
  isHermesEmailCalendlyCtaConfigured,
  readHermesEmailActionMode,
  readHermesEmailActionProvider,
} from "./hermesEmailCommunicationsOperator.mjs";
import {
  areHermesMemoryOperatorGatesOpen,
  readHermesMemoryOperatorMode,
} from "./hermesEmailMemoryOperator.mjs";
import { resolveXAgentSlug } from "./agentProfiles.mjs";

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
  const agentSlug = resolveXAgentSlug(options.agentSlug);
  const agentOptions = { agentSlug };
  const diagnosticBody = buildCreateConversationBody(DIAGNOSTIC_TAVUS_CONFIG, {
    conversationalContext: "diagnostic_context_supported",
  });
  const agentMailReadiness = buildAgentMailAdapterReadiness({
    env,
    now: options.now,
    agentSlug,
  });
  const agentMailSendReadiness = buildAgentMailSendAdapterReadiness({
    env,
    now: options.now,
    agentSlug,
  });

  return {
    runtime_readiness_version: XAGENT_RUNTIME_READINESS_VERSION,
    checked_at: timestamp(options.now),
    agent_slug: agentSlug,
    xagent_session_identity_supported: true,
    memory_context_injection_code_present: true,
    tavus_conversational_context_supported: diagnosticBody.conversational_context === "diagnostic_context_supported",
    memory_context_env_gates_open: areConversationStartMemoryContextGatesOpen(env),
    hermes_memory_operator_code_present: true,
    hermes_memory_operator_env_gates_open: areHermesMemoryOperatorGatesOpen(env),
    hermes_memory_operator_mode: readHermesMemoryOperatorMode(env),
    hermes_memory_operator_gateway_live_calls_enabled:
      areHermesMemoryOperatorGatesOpen(env) && readHermesMemoryOperatorMode(env) === "gateway",
    hermes_email_actions_code_present: true,
    hermes_email_actions_env_gates_open: areHermesEmailActionGatesOpen(env, agentOptions),
    hermes_email_actions_mode: readHermesEmailActionMode(env),
    hermes_email_actions_provider: readHermesEmailActionProvider(env),
    hermes_email_actions_send_mode_requested:
      areHermesEmailActionGatesOpen(env, agentOptions) && readHermesEmailActionMode(env) === "send",
    hermes_email_actions_live_send_enabled: false,
    hermes_email_calendly_cta_code_present: true,
    hermes_email_calendly_cta_configured: isHermesEmailCalendlyCtaConfigured(env),
    email_outbound_contact_store_env_gates_open: areEmailOutboundContactStoreGatesOpen(env),
    agentmail_adapter_code_present: agentMailReadiness.agentmail_adapter_code_present,
    agentmail_adapter_env_gates_open: agentMailReadiness.agentmail_adapter_env_gates_open,
    agentmail_inbox_address_configured: agentMailReadiness.agentmail_inbox_address_configured,
    agentmail_inbox_matches_dani: agentMailReadiness.agentmail_inbox_matches_dani,
    agentmail_inbox_matches_agent: agentMailReadiness.agentmail_inbox_matches_agent,
    agentmail_api_key_present: agentMailReadiness.agentmail_api_key_present,
    agentmail_live_calls_enabled: agentMailSendReadiness.agentmail_live_calls_enabled,
    agentmail_send_adapter_code_present: agentMailSendReadiness.agentmail_send_adapter_code_present,
    agentmail_send_adapter_env_gates_open: agentMailSendReadiness.agentmail_send_adapter_env_gates_open,
    agentmail_send_adapter_mode: agentMailSendReadiness.agentmail_send_adapter_mode,
    agentmail_send_adapter_live_mode_requested: agentMailSendReadiness.agentmail_send_adapter_live_mode_requested,
    agentmail_send_adapter_ready_for_t49_one_send_test:
      agentMailSendReadiness.agentmail_send_adapter_ready_for_t49_one_send_test,
    agentmail_action_ledger_code_present: agentMailSendReadiness.agentmail_action_ledger_code_present,
    agentmail_action_ledger_persistence_enabled: agentMailSendReadiness.agentmail_action_ledger_persistence_enabled,
    agentmail_admin_recipient_configured: agentMailSendReadiness.agentmail_admin_recipient_configured,
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
