import assert from "node:assert/strict";
import {
  createPayloadInput,
  runManualTavusTranscriptDryRun,
  summarizeDryRun,
} from "../scripts/manual-tavus-transcript-dry-run.mjs";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

resetEnv();
delete process.env.XAGENT_ALLOW_LIVE_TAVUS_TRANSCRIPT_TEST;
delete process.env.XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED;
delete process.env.TAVUS_API_KEY;

await assert.rejects(
  () => runManualTavusTranscriptDryRun(["tavus_conversation_test_001"]),
  /XAGENT_ALLOW_LIVE_TAVUS_TRANSCRIPT_TEST=true is required/,
);

resetEnv();
process.env.XAGENT_ALLOW_LIVE_TAVUS_TRANSCRIPT_TEST = "true";
process.env.XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED = "true";
process.env.TAVUS_API_KEY = "test_key";

assert.throws(
  () => createPayloadInput(undefined),
  /provider_conversation_id argument is required/,
);

const dryRun = {
  dry_run_only: true,
  transcript_source: "tavus_get_conversation_verbose",
  tavus_transcript_metadata: {
    source_turn_count: 4,
    retained_memory_turn_count: 2,
    dropped_non_memory_turn_count: 2,
    dropped_non_memory_roles: ["system", "tool"],
  },
  hermes_dispatched: false,
  outbound_action_taken: false,
  live_hermes_called: false,
  codex_openai_escalation: false,
  ollama_generate_called: false,
  resend_called: false,
  production_backend_mutated: false,
  production_memory_database_mutated: false,
  hermes_backend_payload: {
    event_type: "xagent.session.completed",
    tenant_id: "ai-fusion-labs",
    agent_slug: "dani",
    visitor_id: "visitor_manual_live_tavus_test",
    session_id: "xagent_session_manual_live_tavus_test",
    provider: "tavus",
    provider_conversation_id: "tavus_conversation_test_001",
    provider_conversation_id_used_for_namespace: false,
    transcript_hash: "hash_test",
    transcript: [
      { role: "user", content: "redacted payload content that should not print" },
      { role: "agent", content: "another redacted turn that should not print" },
    ],
    memory_namespace: "xagents/ai-fusion-labs/dani/visitor_manual_live_tavus_test/xagent_session_manual_live_tavus_test",
    visitor_memory_namespace: "xagents/ai-fusion-labs/dani/visitor_manual_live_tavus_test",
    idempotency_key: "idempotency_test",
    allowed_operations: ["summarize_session_for_memory"],
    tavus_webhook_required: false,
    live_loop_dependency: false,
  },
};

const summary = summarizeDryRun(dryRun);
const printed = JSON.stringify(summary);

assert.equal(summary.transcript_turn_count, 2);
assert.equal(summary.tavus_transcript_metadata.dropped_non_memory_turn_count, 2);
assert.equal(summary.hermes_dispatched, false);
assert.equal(summary.live_hermes_called, false);
assert.equal(summary.codex_openai_escalation, false);
assert.equal(summary.ollama_generate_called, false);
assert.equal(summary.resend_called, false);
assert.equal(summary.production_backend_mutated, false);
assert.equal(summary.production_memory_database_mutated, false);
assert.equal(Object.hasOwn(summary, "transcript"), false);
assert.equal(printed.includes("redacted payload content that should not print"), false);
assert.deepEqual(summary.allowed_operations, ["summarize_session_for_memory"]);

resetEnv();

console.log("Manual Tavus transcript dry-run script guard checks passed");
