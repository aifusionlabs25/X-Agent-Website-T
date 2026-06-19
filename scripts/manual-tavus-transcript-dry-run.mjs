import { buildSessionCompletedFromTavusDryRun } from "../lib/xagent/sessionCompletedFromTavus.mjs";
import { fileURLToPath } from "node:url";

const ALLOW_ENV = "XAGENT_ALLOW_LIVE_TAVUS_TRANSCRIPT_TEST";
const DRY_RUN_ENV = "XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function requireEnvFlag(key) {
  if (env(key).toLowerCase() !== "true") {
    throw new Error(`${key}=true is required`);
  }
}

function requireValue(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export function createPayloadInput(conversationId) {
  return {
    tenant_id: env("XAGENT_MANUAL_TEST_TENANT_ID") || "ai-fusion-labs",
    agent_slug: env("XAGENT_MANUAL_TEST_AGENT_SLUG") || "dani",
    visitor_id: env("XAGENT_MANUAL_TEST_VISITOR_ID") || "visitor_manual_live_tavus_test",
    session_id: env("XAGENT_MANUAL_TEST_SESSION_ID") || "xagent_session_manual_live_tavus_test",
    provider: "tavus",
    provider_conversation_id: requireValue(conversationId, "provider_conversation_id argument"),
    completed_at: env("XAGENT_MANUAL_TEST_COMPLETED_AT") || undefined,
  };
}

export function summarizeDryRun(dryRun) {
  const payload = dryRun.hermes_backend_payload;
  return {
    dry_run_only: dryRun.dry_run_only,
    transcript_source: dryRun.transcript_source,
    tavus_transcript_metadata: dryRun.tavus_transcript_metadata,
    hermes_dispatched: dryRun.hermes_dispatched,
    outbound_action_taken: dryRun.outbound_action_taken,
    live_hermes_called: dryRun.live_hermes_called,
    codex_openai_escalation: dryRun.codex_openai_escalation,
    ollama_generate_called: dryRun.ollama_generate_called,
    resend_called: dryRun.resend_called,
    production_backend_mutated: dryRun.production_backend_mutated,
    production_memory_database_mutated: dryRun.production_memory_database_mutated,
    event_type: payload.event_type,
    tenant_id: payload.tenant_id,
    agent_slug: payload.agent_slug,
    visitor_id: payload.visitor_id,
    session_id: payload.session_id,
    provider: payload.provider,
    provider_conversation_id: payload.provider_conversation_id,
    provider_conversation_id_used_for_namespace: payload.provider_conversation_id_used_for_namespace,
    transcript_hash: payload.transcript_hash,
    transcript_turn_count: payload.transcript.length,
    memory_namespace: payload.memory_namespace,
    visitor_memory_namespace: payload.visitor_memory_namespace,
    idempotency_key: payload.idempotency_key,
    allowed_operations: payload.allowed_operations,
    tavus_webhook_required: payload.tavus_webhook_required,
    live_loop_dependency: payload.live_loop_dependency,
  };
}

export async function runManualTavusTranscriptDryRun(argv = process.argv.slice(2)) {
  requireEnvFlag(ALLOW_ENV);
  requireEnvFlag(DRY_RUN_ENV);
  requireValue(env("TAVUS_API_KEY"), "TAVUS_API_KEY");

  const input = createPayloadInput(argv[0]);
  const dryRun = await buildSessionCompletedFromTavusDryRun(input);
  return summarizeDryRun(dryRun);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runManualTavusTranscriptDryRun()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
