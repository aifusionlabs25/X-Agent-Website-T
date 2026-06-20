import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_email_live_conversation_start_t39_safe_capture.json";
const docPath = "docs/HERMES_EMAIL_LIVE_CONVERSATION_START_T39_PROOF.md";
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
  "email",
  "returning_email",
  "returningEmail",
  "normalized_email",
  "email_identity_hash",
  "identity_salt_fixture_only",
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
  assert.equal(forbiddenExactKeys.has(key), false, `T39 proof must not include field: ${key}`);
});

assert.equal(proof.artifact_purpose, "hermes_email_live_conversation_start_t39_proof");
assert.equal(proof.phase, "T39");
assert.equal(proof.deployed_commit_minimum, "b09b827");
assert.equal(proof.hosted_route_used, true);
assert.equal(proof.hosted_url, "https://x-agent-website-t.vercel.app/api/conversation/start");
assert.equal(proof.exactly_one_hosted_email_start_post, true);
assert.equal(proof.email_supplied, true);
assert.equal(proof.email_valid, true);
assert.equal(proof.email_value_stored, false);
assert.equal(proof.normalized_email_stored, false);
assert.equal(proof.email_hash_stored, false);

assert.equal(proof.http_status, 200);
assert.equal(proof.hosted_live_start_succeeded, true);
assert.equal(proof.conversation_url_present, true);
assert.equal(proof.actual_conversation_url_stored, false);
assert.match(proof.provider_conversation_id, /^[a-f0-9]{16}$/);
assert.equal(proof.tenant_id, "ai-fusion-labs");
assert.equal(proof.agent_slug, "dani");
assert.match(proof.visitor_id, /^visitor_[0-9a-f-]+$/);
assert.match(proof.session_id, /^xagent_session_[0-9a-f-]+$/);
assert.equal(proof.provider, "tavus");
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
assert.equal(proof.prompt_text_included, false);
assert.equal(proof.memory_summary_included, false);
assert.equal(proof.hash_values_included, false);
assert.equal(proof.namespace_values_included, false);
assert.equal(proof.transcript_content_messages_included, false);
assert.equal(proof.api_key_included, false);

const forbiddenSubstrings = [
  "DANI.Email.Identity",
  "dani.email.identity.fixture",
  "example.invalid",
  "h-email-2-fixture-only-non-production-salt",
  "50fd4f46d1839fc9d426b9a20f7c17150689f629be8d8bc0f0a0d70007e17c7b",
  "Visitor is evaluating Dani",
  "Internal continuity context",
  "hxeimc_",
  "hxeils_",
  "hxeior_",
  "xagents/",
  "tavus_email_identity_fixture_conv",
  "daily.co",
  "tavus.daily",
  "TAVUS_API_KEY",
  "Bearer ",
];

for (const forbidden of forbiddenSubstrings) {
  assert.equal(combined.includes(forbidden), false, `T39 proof leaked ${forbidden}`);
}

assert.equal(
  /[a-f0-9]{64}/i.test(combined),
  false,
  "T39 proof must not include 64-character hash values",
);

console.log("Hermes email live conversation start T39 proof checks passed");
