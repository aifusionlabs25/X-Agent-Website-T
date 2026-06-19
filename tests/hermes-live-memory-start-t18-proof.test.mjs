import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_live_memory_start_t18_safe_capture.json";
const proof = JSON.parse(await readFile(proofPath, "utf8"));
const serialized = JSON.stringify(proof);

function walk(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visitor(key, child);
      walk(child, visitor);
    }
  }
}

const forbiddenExactKeys = new Set([
  "conversation_url",
  "conversational_context",
  "candidate_tavus_prompt_context",
  "recalled_memory_summary",
  "transcript",
  "turns",
  "messages",
  "api_key",
]);

walk(proof, (key) => {
  assert.equal(forbiddenExactKeys.has(key), false, `T18 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_tavus_live_memory_start_t18_proof");
assert.equal(proof.phase, "T18");
assert.equal(proof.route_under_test, "/api/conversation/start");
assert.equal(proof.capture_harness, "scripts/manual-tavus-live-memory-start.mjs");
assert.equal(proof.exactly_one_live_tavus_create_conversation_call, true);
assert.equal(proof.local_route_post_count, 1);
assert.equal(proof.local_route_server_log_status, 200);
assert.equal(proof.http_status, 200);
assert.equal(proof.conversation_url_present, true);
assert.equal(proof.provider_conversation_id, "cc3bf45a98104499");
assert.equal(proof.tenant_id, "ai-fusion-labs");
assert.equal(proof.agent_slug, "dani");
assert.match(proof.visitor_id, /^visitor_/);
assert.match(proof.session_id, /^xagent_session_/);
assert.equal(proof.provider, "tavus");
assert.equal(proof.memory_context_requested, true);
assert.equal(proof.memory_context_applied, true);
assert.equal(proof.tavus_conversational_context_attached, true);

assert.equal(proof.custom_greeting_memory_injection, false);
assert.equal(proof.memory_stores_used, false);
assert.equal(proof.live_hermes_called, false);
assert.equal(proof.openai_called, false);
assert.equal(proof.ollama_generate_called, false);
assert.equal(proof.resend_called, false);
assert.equal(proof.production_database_mutated, false);
assert.equal(proof.production_memory_persistence_used, false);
assert.equal(proof.outbound_action_taken, false);
assert.equal(proof.tavus_room_joined, false);
assert.equal(proof.webhook_added, false);
assert.equal(proof.webhook_registered, false);
assert.equal(proof.actual_conversation_url_stored, false);
assert.equal(proof.prompt_text_included, false);
assert.equal(proof.memory_summary_included, false);
assert.equal(proof.hash_values_included, false);
assert.equal(proof.namespace_values_included, false);
assert.equal(proof.backend_proof_ids_included, false);
assert.equal(proof.transcript_content_messages_included, false);
assert.equal(proof.api_key_included, false);

const forbiddenSubstrings = [
  "https://",
  "http://",
  "daily.co",
  "tavus.daily",
  "The visitor inquired",
  "Internal continuity context",
  "Do not claim emails",
  "hxmr_",
  "hxmc_",
  "hxls_",
  "hxor_",
  "xagents/",
  "TAVUS_API_KEY",
  "Bearer ",
];

for (const forbidden of forbiddenSubstrings) {
  assert.equal(serialized.includes(forbidden), false, `T18 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(serialized), false, "T18 proof must not include hash values");

console.log("Hermes live memory start T18 proof checks passed");
