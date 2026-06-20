import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const docPath = "docs/HERMES_EMAIL_IDENTITY_MEMORY_CONTRACT_T35.md";
const doc = await readFile(docPath, "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const startRouteSource = await readFile("app/api/conversation/start/route.ts", "utf8");
const sessionIdentitySource = await readFile("lib/xagent/sessionIdentity.mjs", "utf8");
const resolverSource = await readFile("lib/xagent/serverSideMemoryContextResolver.mjs", "utf8");
const promptPreviewSource = await readFile("lib/xagent/tavusMemoryPromptPreview.mjs", "utf8");
const transcriptSource = await readFile("lib/tavusTranscript.mjs", "utf8");
const completedPayloadSource = await readFile("lib/xagent/sessionCompletedPayload.mjs", "utf8");
const handoffSource = await readFile("lib/xagent/hermesDispatchHandoff.mjs", "utf8");
const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");

function assertIncludes(text, value) {
  assert.ok(text.includes(value), `${docPath} must include: ${value}`);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isBasicEmailShape(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function deriveEmailIdentityHash({ identitySalt, tenantId, agentSlug, normalizedEmail }) {
  return createHash("sha256")
    .update(`${identitySalt}:${tenantId}:${agentSlug}:${normalizedEmail}`)
    .digest("hex");
}

const normalized = normalizeEmail("  USER+Demo@Example.COM  ");
assert.equal(normalized, "user+demo@example.com");
assert.equal(isBasicEmailShape(normalized), true);
assert.equal(isBasicEmailShape("user example.com"), false);
assert.equal(isBasicEmailShape("user@example"), false);

const hash = deriveEmailIdentityHash({
  identitySalt: "server-side-test-salt",
  tenantId: "ai-fusion-labs",
  agentSlug: "dani",
  normalizedEmail: normalized,
});
assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(
  hash,
  deriveEmailIdentityHash({
    identitySalt: "server-side-test-salt",
    tenantId: "ai-fusion-labs",
    agentSlug: "dani",
    normalizedEmail: "user+demo@example.com",
  }),
);

assertIncludes(doc, "This is a read-only contract/design phase.");
assertIncludes(doc, "No customer-facing UI was changed.");
assertIncludes(doc, "No Tavus conversation was created.");
assertIncludes(doc, "Every Tavus session is new.");
assertIncludes(doc, "Returning-user memory is not recovered from an old room URL");
assertIncludes(doc, "Dani should not ask for or process email mid-session for memory lookup.");

assertIncludes(doc, "Trim leading and trailing whitespace.");
assertIncludes(doc, "Lowercase the trimmed value.");
assertIncludes(doc, "Validate a basic email shape before hashing.");
assertIncludes(doc, "email_identity_hash = sha256(identity_salt + \":\" + tenant_id + \":\" + agent_slug + \":\" + normalized_email)");
assertIncludes(doc, "Never use raw email in a Tavus prompt.");
assertIncludes(doc, "Never store raw email in proof artifacts.");
assertIncludes(doc, "Never include raw email in `conversational_context`.");
assertIncludes(doc, "Raw email storage decision: deferred and consent-gated.");

assertIncludes(doc, "tenant_id = ai-fusion-labs");
assertIncludes(doc, "agent_slug = dani");
assertIncludes(doc, "email_identity_hash = sha256(...)");
assertIncludes(doc, "visitor_memory_namespace = xagents/{tenant_id}/{agent_slug}/email/{email_identity_hash}");
assertIncludes(doc, "session_namespace = xagents/{tenant_id}/{agent_slug}/email/{email_identity_hash}/{session_id}");
assertIncludes(doc, "`provider_conversation_id` remains provenance only");

assertIncludes(doc, "User may optionally provide email before starting Dani.");
assertIncludes(doc, "Transcript is retrieved later through the bounded Tavus transcript adapter.");
assertIncludes(doc, "Hermes creates a memory candidate from redacted/minimized transcript content.");
assertIncludes(doc, "Approved memory is promoted under `visitor_memory_namespace = xagents/{tenant_id}/{agent_slug}/email/{email_identity_hash}`.");

assertIncludes(doc, "User enters email before starting Dani.");
assertIncludes(doc, "Website looks up approved memory by `tenant_id`, `agent_slug`, and `email_identity_hash`.");
assertIncludes(doc, "Website creates a fresh `session_id`.");
assertIncludes(doc, "Website creates a new Tavus conversation.");
assertIncludes(doc, "Website injects only safe, approved, redacted memory context through Tavus `conversational_context`.");
assertIncludes(doc, "Memory must not be placed in `custom_greeting`");
assertIncludes(doc, "this lane does not use Tavus `memory_stores`");

assertIncludes(doc, "If email is supplied and valid but no approved memory is found:");
assertIncludes(doc, "approved_memory_found = false");
assertIncludes(doc, "memory_context_applied = false");
assertIncludes(doc, "Website must not claim that memory exists.");

assertIncludes(doc, "No raw transcript in Tavus prompt.");
assertIncludes(doc, "No raw email in Tavus prompt.");
assertIncludes(doc, "No outbound/email action without separate gates.");
assertIncludes(doc, "No Resend call from the memory identity path.");
assertIncludes(doc, "Human/operator or explicitly approved policy review is required before memory promotion.");
assertIncludes(doc, "The future store must support deletion by `email_identity_hash`.");

assertIncludes(doc, "`x-agent-website-t` owns:");
assertIncludes(doc, "email normalization and basic validation");
assertIncludes(doc, "deriving `email_identity_hash`");
assertIncludes(doc, "approved-memory lookup request before Tavus start");
assertIncludes(doc, "`tavus-xlink-hub` / Hermes lane owns:");
assertIncludes(doc, "memory candidate generation");
assertIncludes(doc, "operator/policy review packet");
assertIncludes(doc, "memory promotion decision");
assertIncludes(doc, "Future shared store contract connects them:");

assertIncludes(doc, "Website T36:");
assertIncludes(doc, "Add a disabled email identity lookup dry-run helper and private preview.");
assertIncludes(doc, "Hermes / `tavus-xlink-hub` Phase H-email-1:");
assertIncludes(doc, "Adapt memory candidate and promotion proof docs to the `email_identity_hash` namespace.");
assertIncludes(doc, "Design the production memory store adapter.");

const forbiddenDocSubstrings = [
  "USER+Demo@Example.COM",
  "user+demo@example.com",
  "DANI-RET-K7P4-M9Q2-T6VA",
  "cef91e8a6b1d9476",
  "caff3b09bd8e7459",
  "daily.co",
  "tavus.daily",
  "TAVUS_API_KEY",
  "Bearer ",
];
for (const forbidden of forbiddenDocSubstrings) {
  assert.equal(doc.includes(forbidden), false, `T35 contract leaked example secret or raw identity token: ${forbidden}`);
}

assert.equal(/[a-f0-9]{64}/i.test(doc), false, "T35 contract must not include concrete hash values");

assert.equal(
  packageJson.scripts["test:hermes-email-identity-memory-contract-t35"],
  "node tests/hermes-email-identity-memory-contract-t35.test.mjs",
);

assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start'/);
assert.equal(tavusPlayerSource.includes("email_identity_hash"), false);
assert.equal(tavusPlayerSource.includes("return_code"), false);

assert.match(startRouteSource, /createDaniSessionIdentity/);
assert.match(startRouteSource, /maybeResolveServerSideMemoryContextForStart/);
assert.equal(startRouteSource.includes("email_identity_hash"), false);
assert.equal(startRouteSource.includes("Resend"), false);
assert.equal(startRouteSource.includes("memory_stores"), false);

assert.match(sessionIdentitySource, /tenant_id: DANI_TENANT_ID/);
assert.match(sessionIdentitySource, /agent_slug: DANI_AGENT_SLUG/);
assert.match(sessionIdentitySource, /visitor_id: prefixedId\("visitor"\)/);
assert.match(sessionIdentitySource, /session_id: prefixedId\("xagent_session"\)/);

assert.match(resolverSource, /returnCodeMemoryLookup/);
assert.equal(resolverSource.includes("email_identity_hash"), false);

assert.match(promptPreviewSource, /conversational_context|candidate_tavus_prompt_context/);
assert.match(promptPreviewSource, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
assert.match(promptPreviewSource, /Do not reveal hashes, namespaces, IDs, or backend machinery/);

assert.match(transcriptSource, /application\.transcription_ready/);
assert.match(transcriptSource, /getTranscriptDetailsForConversation/);

assert.match(completedPayloadSource, /provider_conversation_id_used_for_namespace: false/);
assert.match(completedPayloadSource, /raw_transcript_storage_owned_by_real_backend_policy: true/);
assert.match(completedPayloadSource, /production_memory_database_mutated: false/);
assert.match(completedPayloadSource, /dry_run_preview_only: true/);

assert.match(handoffSource, /raw_transcript_included: false/);
assert.match(handoffSource, /live_hermes_called: false/);
assert.match(handoffSource, /resend_called: false/);

console.log("Hermes email identity memory contract T35 checks passed");
