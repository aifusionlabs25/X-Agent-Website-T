import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const docPath = "docs/HERMES_RETURNING_USER_MEMORY_PRODUCT_ARCHITECTURE_T26.md";
const doc = await readFile(docPath, "utf8");
const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
const startRouteSource = await readFile("app/api/conversation/start/route.ts", "utf8");
const sessionIdentitySource = await readFile("lib/xagent/sessionIdentity.mjs", "utf8");
const transcriptSource = await readFile("lib/tavusTranscript.mjs", "utf8");
const betaSignupSource = await readFile("app/api/beta-signup/route.ts", "utf8");

function assertIncludes(text, value) {
  assert.ok(text.includes(value), `${docPath} must include: ${value}`);
}

assertIncludes(doc, "Each Tavus session is still a new conversation.");
assertIncludes(doc, "Memory continuity comes from app-owned visitor identity plus approved Hermes memory");
assertIncludes(doc, "The room URL recovery and manual join path should stay paused.");
assertIncludes(doc, "The public button sends no request body and no `memory_context`.");
assertIncludes(doc, "T24 path proves that a normal no-body POST can attach `conversational_context` server-side");
assertIncludes(doc, "but it is still fixture/proof-store style");
assertIncludes(doc, "Current limitation: `visitor_id` is random per start");
assertIncludes(doc, "Conversation `caff3b09bd8e7459` could be used later");
assertIncludes(doc, "T26 did not call Tavus.");
assertIncludes(doc, "DANI-RET-XXXX-XXXX-XXXX");
assertIncludes(doc, "return-code capture/lookup preview");
assertIncludes(doc, "no production database");
assertIncludes(doc, "no live Tavus");
assertIncludes(doc, "no Hermes dispatch");
assertIncludes(doc, "no Resend/email");
assertIncludes(doc, "no outbound workflow");

assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.match(startRouteSource, /createDaniSessionIdentity/);
assert.match(startRouteSource, /maybeResolveServerSideMemoryContextForStart/);
assert.match(sessionIdentitySource, /visitor_id: prefixedId\("visitor"\)/);
assert.match(sessionIdentitySource, /session_id: prefixedId\("xagent_session"\)/);
assert.match(transcriptSource, /application\.transcription_ready/);
assert.match(transcriptSource, /getTranscriptDetailsForConversation/);
assert.match(betaSignupSource, /new Resend/);
assert.match(betaSignupSource, /resend\.emails\.send/);

assert.equal(doc.includes("memory_stores` is not used"), true);
assert.equal(doc.includes("Memory is not placed in `custom_greeting`"), true);
assert.equal(doc.includes("Do not send to Tavus:"), true);

console.log("Hermes returning-user memory product architecture T26 doc checks passed");
