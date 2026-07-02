import { buildCreateConversationBody } from "../tavusCreateConversationBody.mjs";
import { buildAgentMailAdapterReadiness } from "./agentMailAdapterReadiness.mjs";
import { buildAgentMailSendAdapterReadiness } from "./agentMailSendAdapter.mjs";
import { areConversationStartMemoryContextGatesOpen } from "./conversationStartMemoryContext.mjs";
import { areEmailOutboundContactStoreGatesOpen } from "./emailMemoryStore.mjs";
import { areHalOperatorStoreGatesOpen } from "./halOperatorStore.mjs";
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
import { areTavusTranscriptionMemoryWebhookGatesOpen } from "./tavusTranscriptionMemoryWebhook.mjs";
import { resolveXAgentSlug } from "./agentProfiles.mjs";
import { HAL_AGENT_SLUG } from "./sessionIdentity.mjs";

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
  const memoryContextGatesOpen = areConversationStartMemoryContextGatesOpen(env, agentOptions);
  const hermesMemoryGatesOpen = areHermesMemoryOperatorGatesOpen(env, agentOptions);
  const hermesMemoryMode = readHermesMemoryOperatorMode(env);
  const hermesEmailActionsGatesOpen = areHermesEmailActionGatesOpen(env, agentOptions);
  const hermesEmailActionsMode = readHermesEmailActionMode(env);
  const tavusWebhookGatesOpen = areTavusTranscriptionMemoryWebhookGatesOpen(env, agentOptions);
  const outboundContactGatesOpen = areEmailOutboundContactStoreGatesOpen(env, agentOptions);
  const halOperatorStoreGatesOpen = agentSlug === HAL_AGENT_SLUG
    ? areHalOperatorStoreGatesOpen(env, agentOptions)
    : false;
  const halHermesActiveGates = {
    tavus_memory_context: memoryContextGatesOpen,
    tavus_transcription_webhook: tavusWebhookGatesOpen,
    hermes_memory_operator: hermesMemoryGatesOpen,
    hermes_email_actions: hermesEmailActionsGatesOpen,
    email_outbound_contact_store: outboundContactGatesOpen,
    agentmail_adapter: agentMailReadiness.agentmail_adapter_env_gates_open,
    agentmail_live_send_adapter: agentMailSendReadiness.agentmail_live_calls_enabled,
    hal_operator_store: halOperatorStoreGatesOpen,
  };
  const halHermesActive = agentSlug === HAL_AGENT_SLUG
    && Object.values(halHermesActiveGates).every(Boolean);

  return {
    runtime_readiness_version: XAGENT_RUNTIME_READINESS_VERSION,
    checked_at: timestamp(options.now),
    agent_slug: agentSlug,
    xagent_session_identity_supported: true,
    memory_context_injection_code_present: true,
    tavus_conversational_context_supported: diagnosticBody.conversational_context === "diagnostic_context_supported",
    memory_context_env_gates_open: memoryContextGatesOpen,
    tavus_transcription_memory_webhook_code_present: true,
    tavus_transcription_memory_webhook_env_gates_open: tavusWebhookGatesOpen,
    hermes_memory_operator_code_present: true,
    hermes_memory_operator_env_gates_open: hermesMemoryGatesOpen,
    hermes_memory_operator_mode: hermesMemoryMode,
    hermes_memory_operator_gateway_live_calls_enabled:
      hermesMemoryGatesOpen && hermesMemoryMode === "gateway",
    hermes_email_actions_code_present: true,
    hermes_email_actions_env_gates_open: hermesEmailActionsGatesOpen,
    hermes_email_actions_mode: hermesEmailActionsMode,
    hermes_email_actions_provider: readHermesEmailActionProvider(env),
    hermes_email_actions_send_mode_requested:
      hermesEmailActionsGatesOpen && hermesEmailActionsMode === "send",
    hermes_email_actions_live_send_enabled: false,
    hermes_email_calendly_cta_code_present: true,
    hermes_email_calendly_cta_configured: isHermesEmailCalendlyCtaConfigured(env),
    email_outbound_contact_store_env_gates_open: outboundContactGatesOpen,
    hal_operator_store_code_present: true,
    hal_operator_store_env_gates_open: halOperatorStoreGatesOpen,
    hal_hermes_active: halHermesActive,
    hal_hermes_active_status: agentSlug !== HAL_AGENT_SLUG
      ? "not_hal"
      : halHermesActive
        ? "active"
        : "missing_required_gates",
    hal_hermes_active_gates: agentSlug === HAL_AGENT_SLUG ? halHermesActiveGates : undefined,
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
