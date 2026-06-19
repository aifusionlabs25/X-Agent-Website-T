import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_live_transcript_dry_run_ca4ec4813b2a8413.json";
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
  "properties",
  "content",
  "raw_content",
  "raw_transcript",
]);

walk(proof, (key) => {
  assert.equal(forbiddenRawKeys.has(key), false, `Proof artifact must not include raw field: ${key}`);
});

assert.equal(proof.conversation_id, "ca4ec4813b2a8413");
assert.equal(proof.application_transcription_ready_returned, true);
assert.equal(proof.hermes_dry_run_payload_built, true);
assert.equal(proof.transcript_summary.source_turn_count, 30);
assert.equal(proof.transcript_summary.retained_memory_turn_count, 20);
assert.equal(proof.transcript_summary.dropped_non_memory_turn_count, 10);
assert.deepEqual(proof.transcript_summary.dropped_non_memory_roles, ["system"]);
assert.equal(proof.transcript_summary.transcript_hash, "438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40");
assert.deepEqual(proof.allowed_operations, ["summarize_session_for_memory"]);
assert.equal(proof.boundary_proof.hermes_dispatched, false);
assert.equal(proof.boundary_proof.live_hermes_called, false);
assert.equal(proof.boundary_proof.codex_openai_escalation, false);
assert.equal(proof.boundary_proof.ollama_generate_called, false);
assert.equal(proof.boundary_proof.resend_called, false);
assert.equal(proof.boundary_proof.production_backend_mutated, false);
assert.equal(proof.boundary_proof.production_memory_database_mutated, false);
assert.equal(proof.boundary_proof.tavus_webhook_required, false);
assert.equal(proof.boundary_proof.webhook_registered, false);
assert.equal(proof.boundary_proof.raw_transcript_included, false);
assert.equal(proof.boundary_proof.raw_transcript_content_stored, false);
assert.equal(serialized.includes("visitor@example.com"), false);

console.log("Hermes live proof artifact guard checks passed");
