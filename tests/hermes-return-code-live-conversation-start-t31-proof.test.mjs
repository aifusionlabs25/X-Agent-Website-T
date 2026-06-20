import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_return_code_live_conversation_start_t31_safe_capture.json";
const docPath = "docs/HERMES_RETURN_CODE_LIVE_CONVERSATION_START_T31_PROOF.md";
const proof = JSON.parse(await readFile(proofPath, "utf8"));
const doc = await readFile(docPath, "utf8");
const combined = `${JSON.stringify(proof)}\n${doc}`;

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
  "return_code",
  "returnCode",
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
  assert.equal(forbiddenExactKeys.has(key), false, `T31 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_return_code_live_conversation_start_t31_proof");
assert.equal(proof.phase, "T31");
assert.equal(proof.deployed_commit, "f726eb0");
assert.equal(proof.deployed_commit_is_required_or_later, true);
assert.equal(proof.production_gate_names_present, true);
assert.equal(proof.all_nine_required_production_gates_confirmed_open, true);
assert.equal(proof.gate_values_stored, false);
assert.equal(proof.hosted_route_used, true);
assert.equal(proof.hosted_start_url, "https://x-agent-website-t.vercel.app/api/conversation/start");
assert.equal(proof.exactly_one_hosted_return_code_start_post, true);
assert.equal(proof.return_code_value_stored, false);

assert.equal(proof.http_status, 200);
assert.equal(proof.return_code_supplied, true);
assert.equal(proof.return_code_valid, true);
assert.equal(proof.conversation_url_present, true);
assert.equal(proof.provider_conversation_id, "cef91e8a6b1d9476");
assert.equal(proof.tenant_id, "ai-fusion-labs");
assert.equal(proof.agent_slug, "dani");
assert.match(proof.visitor_id, /^visitor_[0-9a-f-]{36}$/i);
assert.match(proof.session_id, /^xagent_session_[0-9a-f-]{36}$/i);
assert.equal(proof.provider, "tavus");
assert.equal(proof.new_tavus_conversation_created, true);
assert.equal(proof.direct_tavus_api_call_from_codex, false);
assert.equal(proof.server_side_memory_lookup_attempted, true);
assert.equal(proof.server_side_memory_context_applied, true);
assert.equal(proof.tavus_conversational_context_attached, true);
assert.equal(proof.tavus_room_joined, false);
assert.equal(proof.customer_button_changed, false);
assert.equal(proof.memory_stores_used, false);
assert.equal(proof.custom_greeting_memory_injection, false);
assert.equal(proof.live_hermes_called, false);
assert.equal(proof.openai_called, false);
assert.equal(proof.codex_openai_escalation, false);
assert.equal(proof.ollama_generate_called, false);
assert.equal(proof.resend_called, false);
assert.equal(proof.production_database_mutated, false);
assert.equal(proof.production_memory_persistence_used, false);
assert.equal(proof.production_memory_database_mutated, false);
assert.equal(proof.outbound_action_taken, false);
assert.equal(proof.actual_conversation_url_stored, false);
assert.equal(proof.room_url_stored, false);
assert.equal(proof.prompt_text_included, false);
assert.equal(proof.memory_summary_included, false);
assert.equal(proof.hash_values_included, false);
assert.equal(proof.namespace_values_included, false);
assert.equal(proof.backend_ids_included, false);
assert.equal(proof.transcript_content_messages_included, false);
assert.equal(proof.api_key_included, false);

const forbiddenSubstrings = [
  "DANI-RET-",
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
  assert.equal(combined.includes(forbidden), false, `T31 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "T31 proof must not include hash values");

console.log("Hermes return-code live conversation start T31 proof checks passed");
