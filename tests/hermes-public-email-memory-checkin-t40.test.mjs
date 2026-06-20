import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import emailFixture from "./fixtures/hermes-email-memory-lookup-dani.json" with { type: "json" };
import normalMemoryFixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  maybeResolveServerSideMemoryContextForStart,
} from "../lib/xagent/serverSideMemoryContextResolver.mjs";

const injectionOpen = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
};
const allMemoryOpen = {
  ...injectionOpen,
  XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH: "false",
  XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH: "false",
};

function assertNoUnsafeCheckInLeak(source) {
  const forbidden = [
    "email_identity_hash",
    emailFixture.email_identity_hash,
    emailFixture.identity_salt_fixture_only,
    emailFixture.memory_context.recalled_memory_summary,
    "xagents/ai-fusion-labs/dani/email/",
    "memory_context",
    "return_code",
    "TAVUS_API_KEY",
  ];

  for (const value of forbidden) {
    assert.equal(source.includes(value), false, `public check-in leaked ${value}`);
  }
}

const freshStart = await maybeResolveServerSideMemoryContextForStart(
  { skip_memory: true, memory_mode: "fresh" },
  { env: allMemoryOpen, memoryContext: normalMemoryFixture, emailMemoryFixture: emailFixture },
);
assert.equal(freshStart.memory_context_requested, false);
assert.equal(freshStart.memory_context_applied, false);
assert.equal(freshStart.tavus_conversational_context_attached, false);
assert.equal(freshStart.server_side_memory_context_source, "fresh_start_requested");

const unknownEmailStartsFresh = await maybeResolveServerSideMemoryContextForStart(
  { email: "new.visitor@example.invalid" },
  { env: allMemoryOpen, memoryContext: normalMemoryFixture, emailMemoryFixture: emailFixture },
);
assert.equal(unknownEmailStartsFresh.memory_context_requested, false);
assert.equal(unknownEmailStartsFresh.memory_context_applied, false);
assert.equal(unknownEmailStartsFresh.tavus_conversational_context_attached, false);
assert.equal(unknownEmailStartsFresh.server_side_memory_context_source, "email_identity_no_approved_memory_found");

await assert.rejects(
  () => maybeResolveServerSideMemoryContextForStart(
    { email: "not an email" },
    { env: allMemoryOpen, memoryContext: normalMemoryFixture, emailMemoryFixture: emailFixture },
  ),
  /basic valid email shape/,
);

const playerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(playerSource, /Memory Check-In/);
assert.match(playerSource, /Continue with memory/);
assert.match(playerSource, /Start fresh/);
assert.match(playerSource, /skip_memory/);
assert.match(playerSource, /memory_mode: 'fresh'/);
assert.match(playerSource, /email/);
assert.match(playerSource, /display_name/);
assert.match(playerSource, /JSON\.stringify\(startPayload\)/);
assert.match(playerSource, /NEXT_PUBLIC_XAGENT_EMAIL_MEMORY_CHECKIN_ENABLED/);
assertNoUnsafeCheckInLeak(playerSource);

const doc = await readFile("docs/HERMES_PUBLIC_EMAIL_MEMORY_CHECKIN_T40.md", "utf8");
assert.match(doc, /optional check-in/);
assert.match(doc, /Start fresh/);
assert.match(doc, /skip_memory/);
assert.match(doc, /NEXT_PUBLIC_XAGENT_EMAIL_MEMORY_CHECKIN_ENABLED=false/);
assert.equal(doc.includes(emailFixture.email_identity_hash), false);
assert.equal(doc.includes(emailFixture.identity_salt_fixture_only), false);
assert.equal(doc.includes(emailFixture.memory_context.recalled_memory_summary), false);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:hermes-public-email-memory-checkin-t40"],
  "node tests/hermes-public-email-memory-checkin-t40.test.mjs",
);

console.log("Hermes public email memory check-in T40 checks passed");
