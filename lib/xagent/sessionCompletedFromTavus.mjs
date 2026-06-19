import { getTranscriptDetailsForConversation } from "../tavusTranscript.mjs";
import { buildDryRunResponse } from "./sessionCompletedPayload.mjs";

const ENABLED_ENV = "XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

export function isTavusTranscriptDryRunEnabled(value = env(ENABLED_ENV)) {
  return value.toLowerCase() === "true";
}

export async function buildSessionCompletedFromTavusDryRun(input, options = {}) {
  const enabled = isTavusTranscriptDryRunEnabled(options.enabled ?? env(ENABLED_ENV));
  if (!enabled) {
    throw new Error(`${ENABLED_ENV}=true is required for Tavus transcript dry-run retrieval`);
  }

  const providerConversationId = assertString(input?.provider_conversation_id, "provider_conversation_id");
  const transcriptDetails = await getTranscriptDetailsForConversation(providerConversationId, {
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
  });

  return {
    ...buildDryRunResponse({
      tenant_id: input.tenant_id,
      agent_slug: input.agent_slug,
      visitor_id: input.visitor_id,
      session_id: input.session_id,
      provider: input.provider,
      provider_conversation_id: providerConversationId,
      completed_at: input.completed_at,
      transcript: transcriptDetails.transcript,
    }),
    transcript_source: "tavus_get_conversation_verbose",
    tavus_transcript_metadata: transcriptDetails.metadata,
    tavus_verbose_fetch_mockable: true,
  };
}
