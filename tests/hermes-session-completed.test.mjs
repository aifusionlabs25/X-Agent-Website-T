import assert from "node:assert/strict";
import {
  buildDaniConversationStartResponse,
} from "../lib/xagent/sessionIdentity.mjs";
import {
  buildDryRunResponse,
  buildSessionCompletedPayload,
} from "../lib/xagent/sessionCompletedPayload.mjs";

const identity = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_test_001",
  session_id: "xagent_session_test_001",
  provider: "tavus",
};

const transcript = [
  { role: "user", content: "Reach me at visitor@example.com about repeat lead handoffs." },
  { role: "agent", content: "Dani explained this remains an internal dry-run proof only." },
];

const completedInput = {
  ...identity,
  provider_conversation_id: "tavus_conversation_test_001",
  completed_at: "2026-06-18T21:00:00Z",
  transcript,
};

const startResponse = buildDaniConversationStartResponse(
  {
    conversation_url: "https://daily.example/tavus",
    conversation_id: "tavus_conversation_test_001",
  },
  1234567890,
  identity,
);

assert.equal(startResponse.agent_slug, "dani");
assert.equal(startResponse.session_id, "xagent_session_test_001");
assert.equal(startResponse.visitor_id, "visitor_test_001");
assert.equal(startResponse.provider_conversation_id, "tavus_conversation_test_001");

const dryRun = buildDryRunResponse(completedInput);
const payload = dryRun.hermes_backend_payload;

assert.equal(dryRun.dry_run_only, true);
assert.equal(dryRun.hermes_dispatched, false);
assert.equal(dryRun.live_hermes_called, false);
assert.equal(dryRun.codex_openai_escalation, false);
assert.equal(dryRun.ollama_generate_called, false);
assert.equal(dryRun.resend_called, false);
assert.equal(payload.event_type, "xagent.session.completed");
assert.deepEqual(payload.allowed_operations, ["summarize_session_for_memory"]);
assert.equal(payload.live_loop_dependency, false);
assert.equal(payload.tavus_webhook_required, false);
assert.equal(payload.provider_role, "provenance_only");
assert.equal(payload.provider_conversation_id_used_for_namespace, false);
assert.equal(payload.memory_namespace, "xagents/ai-fusion-labs/dani/visitor_test_001/xagent_session_test_001");
assert.equal(payload.visitor_memory_namespace, "xagents/ai-fusion-labs/dani/visitor_test_001");
assert.equal(payload.memory_namespace.includes("tavus_conversation_test_001"), false);
assert.match(payload.idempotency_key, /tavus_conversation_test_001/);
assert.equal(payload.transcript[0].content.includes("visitor@example.com"), false);
assert.equal(payload.transcript[0].content.includes("[REDACTED_SENSITIVE]"), true);

const repeatPayload = buildSessionCompletedPayload(completedInput);
assert.equal(repeatPayload.transcript_hash, payload.transcript_hash);
assert.equal(repeatPayload.idempotency_key, payload.idempotency_key);

assert.throws(
  () => buildSessionCompletedPayload({ ...completedInput, transcript: [] }),
  /transcript must include at least one turn/,
);

assert.throws(
  () => buildSessionCompletedPayload({ ...completedInput, agent_slug: "james" }),
  /only agent_slug=dani is supported/,
);

console.log("Hermes session-completed dry-run checks passed");
