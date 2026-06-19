import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proofPath = "docs/proofs/hermes_tavus_live_memory_room_url_recovery_t18.json";
const docPath = "docs/HERMES_TAVUS_LIVE_MEMORY_ROOM_URL_RECOVERY.md";
const proof = JSON.parse(await readFile(proofPath, "utf8"));
const proofSerialized = JSON.stringify(proof);
const doc = await readFile(docPath, "utf8");
const combined = `${proofSerialized}\n${doc}`;

assert.deepEqual(Object.keys(proof).sort(), [
  "conversation_url_present",
  "exactly_one_tavus_get_attempt",
  "provider_conversation_id",
  "retrieval_status",
  "tavus_room_joined",
]);

assert.equal(proof.conversation_url_present, true);
assert.equal(proof.provider_conversation_id, "cc3bf45a98104499");
assert.equal(proof.retrieval_status, "conversation_url_recovered");
assert.equal(proof.exactly_one_tavus_get_attempt, true);
assert.equal(proof.tavus_room_joined, false);

const forbiddenSubstrings = [
  "https://",
  "http://",
  "daily.co",
  "tavus.daily",
  "conversation_url\":",
  "actual_conversation_url",
  "TAVUS_API_KEY",
  "Bearer ",
  "The visitor inquired",
  "Internal continuity context",
  "conversational_context",
  "hxmr_",
  "hxmc_",
  "hxls_",
  "hxor_",
  "xagents/",
  "\"transcript\"",
  "\"messages\"",
  "\"content\"",
];

for (const forbidden of forbiddenSubstrings) {
  assert.equal(combined.includes(forbidden), false, `Room URL recovery proof leaked ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(combined), false, "Room URL recovery proof must not include hash values");

console.log("Hermes live memory room URL recovery proof checks passed");
