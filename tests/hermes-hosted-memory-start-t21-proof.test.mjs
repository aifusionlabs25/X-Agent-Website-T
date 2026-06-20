import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_hosted_memory_start_t21_safe_capture.json";
const docPath = "docs/HERMES_TAVUS_HOSTED_MEMORY_START_T21_PROOF.md";
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
  assert.equal(forbiddenExactKeys.has(key), false, `T21 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_tavus_hosted_memory_start_t21_proof");
assert.equal(proof.phase, "T21");
assert.equal(proof.deployed_commit_expected, "862c359");
assert.equal(proof.deployed_commit_confirmed, true);
assert.equal(proof.readiness_checked, true);
assert.equal(proof.runtime_readiness_passed, true);
assert.deepEqual(proof.runtime_readiness_required_fields, {
  xagent_session_identity_supported: true,
  memory_context_injection_code_present: true,
  tavus_conversational_context_supported: true,
  memory_context_env_gates_open: true,
});
assert.equal(proof.exactly_one_hosted_memory_start_post, true);
assert.equal(proof.hosted_route_used, true);
assert.equal(proof.hosted_start_url, "https://x-agent-website-t.vercel.app/api/conversation/start");
assert.equal(proof.normal_customer_button_changed, false);
assert.equal(proof.http_status, 200);
assert.equal(proof.conversation_url_present, true);
assert.equal(proof.provider_conversation_id, "c1fd221a0eaa74c0");
assert.equal(proof.tenant_id, "ai-fusion-labs");
assert.equal(proof.agent_slug, "dani");
assert.equal(proof.provider, "tavus");
assert.equal(proof.memory_context_requested, true);
assert.equal(proof.memory_context_applied, true);
assert.equal(proof.tavus_conversational_context_attached, true);
assert.equal(proof.hosted_memory_attachment_confirmed, true);
assert.equal(proof.result_status, "hosted_post_created_conversation_with_memory_context_attached");

assert.equal(proof.memory_stores_used, false);
assert.equal(proof.custom_greeting_memory_injection, false);
assert.equal(proof.tavus_room_joined, false);
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
  assert.equal(combined.includes(forbidden), false, `T21 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "T21 proof must not include hash values");

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("memory_context"), false);

console.log("Hermes hosted memory start T21 proof checks passed");
