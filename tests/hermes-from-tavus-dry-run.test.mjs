import assert from "node:assert/strict";
import fixture from "./fixtures/tavus-verbose-conversation-transcription-ready.json" with { type: "json" };
import {
  buildSessionCompletedFromTavusDryRun,
} from "../lib/xagent/sessionCompletedFromTavus.mjs";

const completedInput = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_test_001",
  session_id: "xagent_session_test_001",
  provider: "tavus",
  provider_conversation_id: "tavus_conversation_test_001",
  completed_at: "2026-06-18T21:03:00Z",
};

const disabledCalls = [];
await assert.rejects(
  () => buildSessionCompletedFromTavusDryRun(completedInput, {
    enabled: "false",
    apiKey: "test_tavus_key",
    fetchImpl: async (url, init) => {
      disabledCalls.push({ url, init });
      return { ok: true, status: 200, async json() { return fixture; } };
    },
  }),
  /XAGENT_TAVUS_TRANSCRIPT_DRY_RUN_ENABLED=true is required/,
);
assert.equal(disabledCalls.length, 0);

const calls = [];
const mockFetch = async (url, init) => {
  calls.push({ url, init });
  return {
    ok: true,
    status: 200,
    async json() {
      return fixture;
    },
  };
};

const dryRun = await buildSessionCompletedFromTavusDryRun(completedInput, {
  enabled: "true",
  apiKey: "test_tavus_key",
  fetchImpl: mockFetch,
});
const payload = dryRun.hermes_backend_payload;
const repeatDryRun = await buildSessionCompletedFromTavusDryRun(completedInput, {
  enabled: "true",
  apiKey: "test_tavus_key",
  fetchImpl: mockFetch,
});

assert.equal(calls.length, 2);
assert.equal(calls[0].url, "https://tavusapi.com/v2/conversations/tavus_conversation_test_001?verbose=true");
assert.equal(calls[0].init.method, "GET");
assert.equal(calls[0].init.headers["x-api-key"], "test_tavus_key");
assert.equal(dryRun.transcript_source, "tavus_get_conversation_verbose");
assert.equal(dryRun.tavus_transcript_metadata.source_turn_count, 4);
assert.equal(dryRun.tavus_transcript_metadata.retained_memory_turn_count, 2);
assert.equal(dryRun.tavus_transcript_metadata.dropped_non_memory_turn_count, 2);
assert.deepEqual(dryRun.tavus_transcript_metadata.dropped_non_memory_roles, ["system", "tool"]);
assert.equal(dryRun.tavus_verbose_fetch_mockable, true);
assert.equal(dryRun.dry_run_only, true);
assert.equal(dryRun.hermes_dispatched, false);
assert.equal(dryRun.outbound_action_taken, false);
assert.equal(dryRun.live_hermes_called, false);
assert.equal(dryRun.codex_openai_escalation, false);
assert.equal(dryRun.ollama_generate_called, false);
assert.equal(dryRun.resend_called, false);
assert.equal(dryRun.production_backend_mutated, false);
assert.equal(dryRun.production_memory_database_mutated, false);
assert.equal(payload.event_type, "xagent.session.completed");
assert.deepEqual(payload.allowed_operations, ["summarize_session_for_memory"]);
assert.equal(payload.tavus_webhook_required, false);
assert.equal(payload.live_loop_dependency, false);
assert.equal(payload.provider_role, "provenance_only");
assert.equal(payload.provider_conversation_id, "tavus_conversation_test_001");
assert.equal(payload.provider_conversation_id_used_for_namespace, false);
assert.equal(payload.memory_namespace, "xagents/ai-fusion-labs/dani/visitor_test_001/xagent_session_test_001");
assert.equal(payload.memory_namespace.includes("tavus_conversation_test_001"), false);
assert.equal(payload.transcript_hash, repeatDryRun.hermes_backend_payload.transcript_hash);
assert.equal(payload.idempotency_key, repeatDryRun.hermes_backend_payload.idempotency_key);
assert.equal(payload.transcript.every((turn) => turn.role === "user" || turn.role === "agent"), true);
assert.equal(payload.transcript[0].content.includes("visitor@example.com"), false);
assert.equal(payload.transcript[0].content.includes("[REDACTED_SENSITIVE]"), true);

console.log("Hermes from Tavus dry-run composition checks passed");
