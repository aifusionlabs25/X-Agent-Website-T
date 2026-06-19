import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_hosted_normal_route_memory_start_t25_safe_capture.json";
const docPath = "docs/HERMES_TAVUS_HOSTED_NORMAL_ROUTE_MEMORY_START_T25_PROOF.md";
const proof = JSON.parse(await readFile(proofPath, "utf8"));
const proofSerialized = JSON.stringify(proof);
const doc = await readFile(docPath, "utf8");
const combined = `${proofSerialized}\n${doc}`;

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
  "memory_namespace",
  "visitor_memory_namespace",
  "summary_hash",
  "record_hash",
  "transcript",
  "turns",
  "messages",
  "content",
  "api_key",
]);

walk(proof, (key) => {
  assert.equal(forbiddenExactKeys.has(key), false, `T25 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_tavus_hosted_normal_route_memory_start_t25_proof");
assert.equal(proof.phase, "T25");
assert.equal(proof.proof_status, "blocked_before_hosted_post");
assert.equal(proof.production_deployed_commit, "862c359");
assert.equal(proof.production_t24_code_confirmed, false);
assert.equal(proof.local_t24_changes_uncommitted, true);
assert.equal(proof.runtime_readiness_checked, true);
assert.equal(proof.runtime_readiness_base_memory_passed, true);
assert.deepEqual(proof.runtime_readiness_required_fields, {
  xagent_session_identity_supported: true,
  memory_context_injection_code_present: true,
  tavus_conversational_context_supported: true,
  memory_context_env_gates_open: true,
});
assert.equal(proof.production_six_memory_gates_checked, true);
assert.equal(proof.production_six_memory_gates_open, true);
assert.deepEqual(proof.production_six_memory_gate_matches, {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: true,
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: true,
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: true,
  XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED: true,
  XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED: true,
  XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH: true,
});

assert.equal(proof.hosted_start_url, "https://x-agent-website-t.vercel.app/api/conversation/start");
assert.equal(proof.hosted_no_body_post_attempted, false);
assert.equal(proof.exactly_one_hosted_no_body_post, false);
assert.equal(proof.normal_no_body_route_used, false);
assert.equal(proof.http_status, null);
assert.equal(proof.conversation_url_present, false);
assert.equal(proof.provider_conversation_id, null);
assert.equal(proof.server_side_memory_lookup_attempted, false);
assert.equal(proof.server_side_memory_context_applied, false);
assert.equal(proof.tavus_conversational_context_attached, false);
assert.equal(proof.customer_button_changed, false);
assert.equal(proof.new_tavus_conversation_created, false);
assert.equal(proof.tavus_room_joined, false);

assert.equal(proof.memory_stores_used, false);
assert.equal(proof.custom_greeting_memory_injection, false);
assert.equal(proof.live_hermes_called, false);
assert.equal(proof.openai_called, false);
assert.equal(proof.ollama_generate_called, false);
assert.equal(proof.resend_called, false);
assert.equal(proof.production_database_mutated, false);
assert.equal(proof.production_memory_persistence_used, false);
assert.equal(proof.outbound_action_taken, false);
assert.equal(proof.actual_conversation_url_stored, false);
assert.equal(proof.prompt_text_included, false);
assert.equal(proof.memory_summary_included, false);
assert.equal(proof.hash_values_included, false);
assert.equal(proof.namespace_values_included, false);
assert.equal(proof.backend_ids_included, false);
assert.equal(proof.transcript_content_messages_included, false);
assert.equal(proof.api_key_included, false);

const forbiddenSubstrings = [
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
  assert.equal(combined.includes(forbidden), false, `T25 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "T25 proof must not include hash values");

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

console.log("Hermes hosted normal-route memory start T25 proof checks passed");
