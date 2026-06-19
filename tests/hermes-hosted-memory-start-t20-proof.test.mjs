import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_hosted_memory_start_t20_safe_capture.json";
const docPath = "docs/HERMES_TAVUS_HOSTED_MEMORY_START_T20_PROOF.md";
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
  "transcript",
  "turns",
  "messages",
  "api_key",
]);

walk(proof, (key) => {
  assert.equal(forbiddenExactKeys.has(key), false, `T20 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_tavus_hosted_memory_start_t20_proof");
assert.equal(proof.phase, "T20");
assert.equal(proof.exactly_one_hosted_memory_start_post, true);
assert.equal(proof.hosted_route_used, true);
assert.equal(proof.hosted_start_url, "https://x-agent-website-t.vercel.app/api/conversation/start");
assert.equal(proof.normal_customer_button_changed, false);
assert.equal(proof.http_status, 200);
assert.equal(proof.conversation_url_present, true);
assert.equal(proof.provider_conversation_id, "c4a71fe80750a436");
assert.equal(proof.memory_context_requested, false);
assert.equal(proof.memory_context_applied, false);
assert.equal(proof.tavus_conversational_context_attached, false);
assert.equal(proof.hosted_memory_attachment_confirmed, false);
assert.equal(proof.result_status, "hosted_post_created_conversation_but_memory_flags_false");

assert.equal(proof.memory_stores_used, false);
assert.equal(proof.custom_greeting_memory_injection, false);
assert.equal(proof.tavus_room_joined, false);
assert.equal(proof.live_hermes_called, false);
assert.equal(proof.openai_called, false);
assert.equal(proof.ollama_generate_called, false);
assert.equal(proof.resend_called, false);
assert.equal(proof.production_database_mutated, false);
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
  assert.equal(combined.includes(forbidden), false, `T20 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "T20 proof must not include hash values");

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("memory_context"), false);

console.log("Hermes hosted memory start T20 proof checks passed");
