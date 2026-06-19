import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_DISABLED_DISPATCH_HANDOFF_DESIGN.md", "utf8");
const proof = JSON.parse(await readFile("docs/proofs/hermes_tavus_live_transcript_dry_run_ca4ec4813b2a8413.json", "utf8"));

const requiredDocSnippets = [
  "Status: design only. No Hermes dispatch is implemented by this document.",
  "docs/proofs/hermes_tavus_live_transcript_dry_run_ca4ec4813b2a8413.json",
  "allowed_operations=[\"summarize_session_for_memory\"]",
  "XAGENT_HERMES_DISPATCH_ENABLED=false",
  "XAGENT_HERMES_DANI_PILOT_ENABLED=false",
  "XAGENT_HERMES_DISPATCH_KILL_SWITCH=true",
  "Recommended first option.",
  "raw_transcript_included=false",
  "hermes_dispatched=false",
  "outbound_action_taken=false",
  "implement a disabled local job-file handoff skeleton",
];

for (const snippet of requiredDocSnippets) {
  assert.equal(doc.includes(snippet), true, `Missing design snippet: ${snippet}`);
}

assert.equal(doc.includes("XAGENT_HERMES_DISPATCH_ENABLED=true"), false);
assert.equal(doc.includes("XAGENT_HERMES_DANI_PILOT_ENABLED=true"), false);
assert.equal(doc.includes("XAGENT_HERMES_DISPATCH_KILL_SWITCH=false"), false);
assert.equal(doc.includes("hermes_dispatched=true"), false);
assert.equal(doc.includes("webhook_registered=true"), false);
assert.equal(doc.includes("production_database_mutated=true"), false);

assert.equal(proof.conversation_id, "ca4ec4813b2a8413");
assert.equal(proof.hermes_dry_run_payload_built, true);
assert.deepEqual(proof.allowed_operations, ["summarize_session_for_memory"]);
assert.equal(proof.boundary_proof.hermes_dispatched, false);
assert.equal(proof.boundary_proof.live_hermes_called, false);
assert.equal(proof.boundary_proof.raw_transcript_included, false);

console.log("Hermes disabled dispatch design guard checks passed");
