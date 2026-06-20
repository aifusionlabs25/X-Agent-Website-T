import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_return_code_preview_ui_hosted_t34_safe_capture.json";
const docPath = "docs/HERMES_RETURN_CODE_PREVIEW_UI_HOSTED_T34_PROOF.md";
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
  assert.equal(forbiddenExactKeys.has(key), false, `T34 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_return_code_preview_ui_hosted_t34_proof");
assert.equal(proof.phase, "T34");
assert.equal(proof.deployed_commit, "53058f3");
assert.equal(proof.t33_commit_deployed, true);
assert.equal(proof.hosted_page_url, "https://x-agent-website-t.vercel.app/admin/hermes-return-code-preview");
assert.equal(proof.hosted_page_http_status, 200);
assert.equal(proof.hosted_page_reachable, true);
assert.equal(proof.hosted_preview_page_dynamic, true);
assert.equal(proof.preview_ui_gate_open, true);
assert.equal(proof.all_nine_return_code_memory_gates_open, true);
assert.equal(proof.gate_values_stored, false);
assert.equal(proof.enabled_state_visible, true);
assert.equal(proof.disabled_state_visible, false);
assert.equal(proof.no_tavus_create_copy_visible, true);
assert.equal(
  proof.dry_run_route_url,
  "https://x-agent-website-t.vercel.app/api/xagent/return-code-conversation-start/dry-run",
);
assert.equal(proof.dry_run_route_called, true);
assert.equal(proof.exactly_one_hosted_ui_dry_run_post, true);
assert.equal(proof.posted_to_conversation_start, false);
assert.equal(proof.conversation_start_route_called, false);
assert.equal(proof.return_code_value_stored, false);
assert.equal(proof.dry_run_http_status, 200);
assert.equal(proof.return_code_supplied, true);
assert.equal(proof.return_code_valid, true);
assert.equal(proof.memory_context_requested, true);
assert.equal(proof.server_side_memory_lookup_attempted, true);
assert.equal(proof.server_side_memory_context_applied, true);
assert.equal(proof.tavus_conversational_context_attached, true);
assert.equal(proof.tavus_create_conversation_called, false);
assert.equal(proof.new_tavus_conversation_created, false);
assert.equal(proof.tavus_room_joined, false);
assert.equal(proof.public_tavus_player_changed, false);
assert.equal(proof.memory_stores_used, false);
assert.equal(proof.custom_greeting_memory_injection, false);
assert.equal(proof.live_tavus_called, false);
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
  assert.equal(combined.includes(forbidden), false, `T34 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "T34 proof must not include hash values");

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("return_code"), false);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

console.log("Hermes return-code preview UI hosted T34 proof checks passed");
