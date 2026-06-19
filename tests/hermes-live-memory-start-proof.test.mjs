import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_live_memory_start_20260619T075555.json";
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

const forbiddenRawKeys = new Set([
  "transcript",
  "turns",
  "messages",
  "content",
  "raw_content",
  "raw_transcript",
  "conversational_context",
  "candidate_tavus_prompt_context",
  "recalled_memory_summary",
  "memory_namespace",
  "visitor_memory_namespace",
  "summary_hash",
  "record_hash",
  "source_transcript_hash",
  "redacted_transcript_hash",
  "api_key",
]);

walk(proof, (key) => {
  assert.equal(forbiddenRawKeys.has(key), false, `Proof artifact must not include raw/private field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_tavus_live_memory_start_proof");
assert.equal(proof.phase, "T17");
assert.equal(proof.route_under_test, "/api/conversation/start");
assert.equal(proof.live_attempt.exactly_one_live_tavus_create_conversation_call, true);
assert.equal(proof.live_attempt.local_route_post_count, 1);
assert.equal(proof.live_attempt.local_route_server_log_status, 200);
assert.equal(proof.live_attempt.tavus_create_conversation_accepted_inferred_from_route_200, true);
assert.equal(proof.live_attempt.client_safe_response_capture_succeeded, false);
assert.equal(proof.live_attempt.memory_context_requested, true);
assert.equal(proof.live_attempt.memory_context_applied, true);
assert.equal(proof.live_attempt.tavus_conversational_context_attached, true);
assert.equal(proof.live_attempt.agent_slug, "dani");
assert.equal(proof.live_attempt.provider, "tavus");
assert.equal(proof.live_attempt.conversation_url_present, null);
assert.equal(proof.live_attempt.provider_conversation_id, null);
assert.equal(proof.live_attempt.conversation_id, null);

assert.equal(proof.boundary_flags.custom_greeting_memory_injection, false);
assert.equal(proof.boundary_flags.memory_stores_used, false);
assert.equal(proof.boundary_flags.live_hermes_called, false);
assert.equal(proof.boundary_flags.openai_called, false);
assert.equal(proof.boundary_flags.ollama_generate_called, false);
assert.equal(proof.boundary_flags.resend_called, false);
assert.equal(proof.boundary_flags.production_database_mutated, false);
assert.equal(proof.boundary_flags.production_memory_persistence_used, false);
assert.equal(proof.boundary_flags.outbound_action_taken, false);
assert.equal(proof.boundary_flags.tavus_room_joined, false);
assert.equal(proof.boundary_flags.webhook_added, false);
assert.equal(proof.boundary_flags.webhook_registered, false);
assert.equal(proof.boundary_flags.raw_transcript_content_included, false);
assert.equal(proof.boundary_flags.prompt_text_included, false);
assert.equal(proof.boundary_flags.memory_summary_included, false);
assert.equal(proof.boundary_flags.hashes_included, false);
assert.equal(proof.boundary_flags.namespaces_included, false);
assert.equal(proof.boundary_flags.api_key_included, false);

const forbiddenSubstrings = [
  "The visitor inquired",
  "Internal continuity context",
  "Do not claim emails",
  "hxmr_",
  "hxmc_",
  "hxls_",
  "hxor_",
  "xagents/",
  "ca4ec4813b2a8413",
  "TAVUS_API_KEY=",
  "Bearer ",
];

for (const forbidden of forbiddenSubstrings) {
  assert.equal(serialized.includes(forbidden), false, `Proof artifact leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(serialized), false, "Proof artifact must not include transcript or summary hashes");

console.log("Hermes live memory start proof checks passed");
