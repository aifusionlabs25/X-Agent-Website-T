import { extractTranscriptDetailsFromTranscriptionReadyEvent } from "../tavusTranscript.mjs";
import { storeEmailMemoryFromConversationTranscript } from "./emailMemoryStore.mjs";

const ENABLED_ENV = "XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH";
const CALLBACK_TOKEN_ENV = "XAGENT_TAVUS_CALLBACK_TOKEN";
const TRANSCRIPTION_READY_EVENT = "application.transcription_ready";

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV, overrides),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV, overrides),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV, overrides),
  };
}

export function areTavusTranscriptionMemoryWebhookGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

function safeBase(overrides = {}) {
  return {
    tavus_transcription_memory_webhook_enabled: Boolean(overrides.enabled),
    webhook_event_received: Boolean(overrides.webhook_event_received),
    event_type: overrides.event_type ?? null,
    provider_conversation_id_present: Boolean(overrides.provider_conversation_id_present),
    transcription_ready_processed: Boolean(overrides.transcription_ready_processed),
    memory_store_attempted: Boolean(overrides.memory_store_attempted),
    memory_record_stored: Boolean(overrides.memory_record_stored),
    memory_store_status: overrides.memory_store_status ?? "not_attempted",
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    outbound_action_taken: false,
  };
}

function assertCallbackToken(options = {}) {
  const expected = env(CALLBACK_TOKEN_ENV, options.env ?? process.env);
  if (!expected) return;
  if (options.callbackToken !== expected) {
    throw new Error("invalid Tavus callback token");
  }
}

export async function handleTavusTranscriptionMemoryWebhook(payload, options = {}) {
  const envSource = options.env ?? process.env;
  const eventType = typeof payload?.event_type === "string" ? payload.event_type : null;
  const providerConversationId = typeof payload?.conversation_id === "string" ? payload.conversation_id.trim() : "";
  const enabled = areTavusTranscriptionMemoryWebhookGatesOpen(envSource);

  if (!enabled) {
    return safeBase({
      enabled: false,
      webhook_event_received: true,
      event_type: eventType,
      provider_conversation_id_present: Boolean(providerConversationId),
      memory_store_status: "webhook_disabled",
    });
  }

  assertCallbackToken({ env: envSource, callbackToken: options.callbackToken });

  if (eventType !== TRANSCRIPTION_READY_EVENT) {
    return safeBase({
      enabled: true,
      webhook_event_received: true,
      event_type: eventType,
      provider_conversation_id_present: Boolean(providerConversationId),
      memory_store_status: "ignored_event_type",
    });
  }

  if (!providerConversationId) {
    throw new Error("conversation_id is required for transcription memory webhook");
  }

  const transcriptDetails = extractTranscriptDetailsFromTranscriptionReadyEvent(payload);
  const storeResult = await storeEmailMemoryFromConversationTranscript(
    {
      provider_conversation_id: providerConversationId,
      transcript: transcriptDetails.transcript,
      transcriptMetadata: transcriptDetails.metadata,
    },
    options,
  );

  return {
    ...safeBase({
      enabled: true,
      webhook_event_received: true,
      event_type: eventType,
      provider_conversation_id_present: true,
      transcription_ready_processed: true,
      memory_store_attempted: storeResult.memory_store_attempted,
      memory_record_stored: storeResult.memory_record_stored,
      memory_store_status: storeResult.memory_store_status,
    }),
    memory_record_id: storeResult.memory_record_id,
    raw_email_stored: false,
    normalized_email_stored: false,
    raw_transcript_stored: false,
    production_memory_database_mutated: Boolean(storeResult.production_memory_database_mutated),
  };
}
