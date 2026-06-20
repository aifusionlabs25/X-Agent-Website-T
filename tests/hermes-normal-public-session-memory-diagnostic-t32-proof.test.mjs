import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_normal_public_session_memory_diagnostic_t32.json";
const docPath = "docs/HERMES_NORMAL_PUBLIC_SESSION_MEMORY_DIAGNOSTIC_T32.md";
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
  assert.equal(forbiddenExactKeys.has(key), false, `T32 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_normal_public_session_memory_diagnostic_t32");
assert.equal(proof.phase, "T32");
assert.equal(proof.provider_conversation_id, "c683efa0a485a43f");
assert.equal(proof.normal_public_site_session, true);
assert.equal(proof.controlled_t31_return_code_session, false);
assert.equal(proof.return_code_supplied, false);
assert.equal(proof.user_identity_supplied, false);
assert.equal(proof.email_identity_supplied, false);
assert.equal(proof.account_identity_supplied, false);
assert.equal(proof.public_tavus_player_posts_no_body, true);
assert.equal(proof.public_ui_return_code_capture_present, false);
assert.equal(proof.public_ui_email_identity_capture_present, false);
assert.equal(proof.route_random_visitor_id_per_start, true);
assert.equal(proof.production_memory_store_available, false);
assert.equal(proof.real_prior_session_memory_available, false);
assert.equal(proof.remembered_context_expected, false);
assert.equal(proof.remembered_context_observed, false);
assert.equal(proof.root_cause, "missing_returning_user_identity_and_real_memory_store");
assert.equal(proof.t25_normal_no_body_fixture_path_is_user_specific_memory, false);
assert.equal(proof.t30_return_code_dry_run_path_succeeded, true);
assert.equal(proof.T31_return_code_path_still_valid, true);
assert.equal(proof.t31_provider_conversation_id, "cef91e8a6b1d9476");
assert.equal(proof.tavus_get_attempted, false);
assert.equal(proof.new_tavus_conversation_created, false);
assert.equal(proof.conversation_start_post_attempted, false);
assert.equal(proof.tavus_room_joined, false);

assert.equal(proof.raw_transcript_stored, false);
assert.equal(proof.room_url_stored, false);
assert.equal(proof.actual_return_code_value_stored, false);
assert.equal(proof.prompt_text_included, false);
assert.equal(proof.memory_summary_included, false);
assert.equal(proof.hash_values_included, false);
assert.equal(proof.namespace_values_included, false);
assert.equal(proof.transcript_content_messages_included, false);
assert.equal(proof.api_key_included, false);
assert.equal(proof.live_hermes_called, false);
assert.equal(proof.openai_called, false);
assert.equal(proof.codex_openai_escalation, false);
assert.equal(proof.ollama_generate_called, false);
assert.equal(proof.resend_called, false);
assert.equal(proof.production_database_mutated, false);
assert.equal(proof.production_memory_persistence_used, false);
assert.equal(proof.outbound_action_taken, false);
assert.equal(proof.recommended_next_phase, "private_return_code_or_email_capture_ui_preview");

assert.equal(doc.includes("fetch('/api/conversation/start', { method: 'POST' })"), true);
assert.match(doc, /missing_returning_user_identity_and_real_memory_store/);
assert.equal(
  doc.includes("T31 proved a controlled hosted `/api/conversation/start` request with a valid return-code body"),
  true,
);
assert.match(doc, /This was a normal public website session, not the controlled T31 return-code session/);

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("return_code"), false);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

const sessionIdentitySource = await readFile("lib/xagent/sessionIdentity.mjs", "utf8");
assert.match(sessionIdentitySource, /visitor_id: prefixedId\("visitor"\)/);
assert.match(sessionIdentitySource, /session_id: prefixedId\("xagent_session"\)/);

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
  assert.equal(combined.includes(forbidden), false, `T32 proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "T32 proof must not include hash values");

console.log("Hermes normal public session memory diagnostic T32 proof checks passed");
