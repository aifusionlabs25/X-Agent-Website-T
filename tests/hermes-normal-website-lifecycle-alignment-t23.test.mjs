import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_NORMAL_WEBSITE_LIFECYCLE_ALIGNMENT_T23.md", "utf8");
const tavusPlayer = await readFile("components/TavusPlayer.tsx", "utf8");
const startRoute = await readFile("app/api/conversation/start/route.ts", "utf8");
const transcriptHelper = await readFile("lib/tavusTranscript.mjs", "utf8");
const betaSignupRoute = await readFile("app/api/beta-signup/route.ts", "utf8");

assert.match(tavusPlayer, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayer.includes("memory_context"), false);
assert.equal(tavusPlayer.includes("JSON.stringify"), false);

assert.match(startRoute, /createDaniSessionIdentity/);
assert.match(startRoute, /readOptionalJsonBody/);
assert.match(startRoute, /conversationalContext: memoryContext\.conversationalContext/);
assert.equal(startRoute.includes("getMemory"), false);
assert.equal(startRoute.includes("recallMemory"), false);
assert.equal(startRoute.includes("memory_stores"), false);

assert.match(transcriptHelper, /\/v2\/conversations/);
assert.match(transcriptHelper, /verbose=true/);
assert.match(transcriptHelper, /application\.transcription_ready/);
assert.match(transcriptHelper, /return null/);

assert.match(betaSignupRoute, /new Resend/);
assert.match(betaSignupRoute, /resend\.emails\.send/);

const requiredDocSnippets = [
  "normal website button does not currently send `memory_context`",
  "normal route does not auto-fetch memory server-side",
  "Current transcript retrieval exists only in proof/helper paths",
  "caff3b09bd8e7459",
  "It was not queried during T23",
  "There is no production transcript persistence in the normal website flow",
  "There is no automatic transcript retrieval when the user leaves the room",
  "Resend exists for the beta sign-up form, not the Hermes memory flow",
  "T21 proved the hosted route can attach memory when a special harness posts `memory_context`",
  "disabled-by-default normal-site server-side memory lookup/injection path",
  "disabled post-session Hermes handoff path",
];

for (const snippet of requiredDocSnippets) {
  assert.equal(doc.includes(snippet), true, `T23 audit doc missing: ${snippet}`);
}

const forbiddenDocClaims = [
  "T23 created a Tavus conversation",
  "T23 joined the Tavus room",
  "T23 fetched the transcript",
  "memory was written to production",
  "Hermes was called live",
];

for (const claim of forbiddenDocClaims) {
  assert.equal(doc.includes(claim), false, `T23 audit doc contains forbidden claim: ${claim}`);
}

console.log("Hermes normal website lifecycle alignment T23 checks passed");
