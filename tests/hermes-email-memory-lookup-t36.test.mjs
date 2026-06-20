import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/hermes-email-memory-lookup-dani.json" with { type: "json" };
import {
  areEmailMemoryLookupGatesOpen,
  buildEmailMemoryLookupDryRunResponse,
  buildGatedEmailMemoryLookupDryRunResponse,
  buildSafeEmailMemoryLookupUnavailableResponse,
  deriveEmailIdentityHash,
  isBasicEmailIdentityShape,
  normalizeEmailIdentityInput,
  resolveEmailMemoryContext,
} from "../lib/xagent/emailIdentityMemoryLookup.mjs";
import { buildConversationStartMemoryContextForRequestBody } from "../lib/xagent/conversationStartMemoryContext.mjs";

const validFixtureEmail = "  DANI.Email.Identity.Fixture@Example.Invalid  ";
const normalizedFixtureEmail = "dani.email.identity.fixture@example.invalid";
const openLookupGates = {
  XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const openTavusMemoryGates = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
};
const forbiddenResponseSubstrings = [
  validFixtureEmail.trim(),
  normalizedFixtureEmail,
  fixture.email_identity_hash,
  fixture.identity_salt_fixture_only,
  fixture.memory_context.recalled_memory_summary,
  "Internal continuity context for Dani",
  "candidate_tavus_prompt_context",
  "recalled_memory_summary",
  "identity_salt_fixture_only",
  "memory_namespace",
  "visitor_memory_namespace",
  "summary_hash",
  "source_transcript_hash",
  "redacted_transcript_hash",
  "provider_conversation_id",
  "hxeimc_",
  "hxeils_",
  "hxeior_",
  "xagents/",
  "transcript",
  "messages",
  "content",
  "TAVUS_API_KEY",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoUnsafeResponseLeak(response) {
  const serialized = JSON.stringify(response);
  const forbiddenKeys = new Set([
    "memory_context",
    "candidate_tavus_prompt_context",
    "recalled_memory_summary",
    "email_identity_hash",
    "identity_salt_fixture_only",
    "normalized_email",
    "raw_email",
    "transcript",
    "messages",
    "content",
    "provenance",
    "summary_hash",
  ]);

  function walk(value) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `email lookup response included unsafe field ${key}`);
      walk(child);
    }
  }

  walk(response);
  for (const forbidden of forbiddenResponseSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `email lookup response leaked ${forbidden}`);
  }
}

async function assertNoServiceCalls(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("email memory lookup preview tests must not call live services");
  };
  try {
    const result = await fn();
    assert.deepEqual(calls, []);
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  assert.equal(areEmailMemoryLookupGatesOpen({}), false);
  assert.equal(areEmailMemoryLookupGatesOpen({
    XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED: "true",
    XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED: "true",
    XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH: "true",
  }), false);
  assert.equal(areEmailMemoryLookupGatesOpen(openLookupGates), true);

  assert.equal(normalizeEmailIdentityInput(validFixtureEmail), normalizedFixtureEmail);
  assert.equal(isBasicEmailIdentityShape(normalizedFixtureEmail), true);
  assert.equal(isBasicEmailIdentityShape(""), false);
  assert.equal(isBasicEmailIdentityShape("missing-at.example.invalid"), false);
  assert.equal(isBasicEmailIdentityShape("two@@example.invalid"), false);
  assert.equal(isBasicEmailIdentityShape("has space@example.invalid"), false);
  assert.equal(isBasicEmailIdentityShape("missing-suffix@example"), false);

  assert.equal(
    deriveEmailIdentityHash({
      identitySalt: fixture.identity_salt_fixture_only,
      tenantId: fixture.tenant_id,
      agentSlug: fixture.agent_slug,
      normalizedEmail: normalizedFixtureEmail,
    }),
    fixture.email_identity_hash,
  );

  assert.throws(
    () => buildGatedEmailMemoryLookupDryRunResponse({ email: validFixtureEmail }, { env: {} }),
    /XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED must be exactly true/,
  );

  const disabledResponse = buildSafeEmailMemoryLookupUnavailableResponse({ email: validFixtureEmail });
  assert.equal(disabledResponse.email_memory_lookup_preview_enabled, false);
  assert.equal(disabledResponse.email_supplied, true);
  assert.equal(disabledResponse.email_valid, false);
  assert.equal(disabledResponse.email_identity_hash_derived, false);
  assert.equal(disabledResponse.memory_context_preview_available, false);
  assertNoUnsafeResponseLeak(disabledResponse);

  const resolved = await assertNoServiceCalls(() => resolveEmailMemoryContext({ email: validFixtureEmail }));
  assert.equal(resolved.email_valid, true);
  assert.equal(resolved.email_identity_hash_derived, true);
  assert.equal(resolved.agent_slug, "dani");
  assert.equal(resolved.tenant_id, "ai-fusion-labs");
  assert.equal(resolved.lookup_source, "local_email_identity_fixture_proof_store");
  assert.equal(resolved.local_fixture_only, true);
  assert.equal(resolved.memory_context.recalled_memory_summary, fixture.memory_context.recalled_memory_summary);
  assert.equal(resolved.session_start_memory_context_preview.memory_context_preview_enabled, true);
  assert.equal(resolved.session_start_memory_context_preview.production_memory_database_mutated, false);
  assert.equal(resolved.session_start_memory_context_preview.outbound_action_taken, false);

  const safeResponse = buildGatedEmailMemoryLookupDryRunResponse(
    { email: validFixtureEmail },
    { env: openLookupGates },
  );
  assert.deepEqual(safeResponse, {
    dry_run_only: true,
    internal_route_only: true,
    email_memory_lookup_preview_enabled: true,
    email_supplied: true,
    email_valid: true,
    email_identity_hash_derived: true,
    agent_slug: "dani",
    tenant_id: "ai-fusion-labs",
    memory_context_preview_available: true,
    server_side_memory_context_applied: false,
    memory_context_applied: false,
    tavus_prompt_injection_performed: false,
    tavus_create_conversation_called: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    codex_openai_escalation: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    production_memory_database_mutated: false,
    outbound_action_taken: false,
    lookup_source: "local_email_identity_fixture_proof_store",
    local_fixture_only: true,
  });
  assertNoUnsafeResponseLeak(safeResponse);

  assert.throws(
    () => buildEmailMemoryLookupDryRunResponse({ email: "unknown@example.invalid" }),
    /email identity was not found/,
  );
  assert.throws(
    () => resolveEmailMemoryContext({ email: validFixtureEmail }, {
      fixture: { ...clone(fixture), agent_slug: "james" },
    }),
    /agent_slug must be dani/,
  );
  assert.throws(
    () => resolveEmailMemoryContext({ email: validFixtureEmail }, {
      fixture: { ...clone(fixture), production_database_mutated: true },
    }),
    /production mutation flags must be false/,
  );
  assert.throws(
    () => resolveEmailMemoryContext({ email: validFixtureEmail }, {
      fixture: { ...clone(fixture), raw_email: normalizedFixtureEmail },
    }),
    /raw_email/,
  );
  assert.throws(
    () => resolveEmailMemoryContext({ email: validFixtureEmail }, {
      fixture: { ...clone(fixture), memory_context: { ...clone(fixture.memory_context), messages: [] } },
    }),
    /messages/,
  );

  const conversationStartMemory = buildConversationStartMemoryContextForRequestBody(
    { memory_context: resolved.memory_context },
    { env: openTavusMemoryGates },
  );
  assert.equal(conversationStartMemory.memory_context_requested, true);
  assert.equal(conversationStartMemory.memory_context_applied, true);
  assert.equal(conversationStartMemory.tavus_conversational_context_attached, true);
  assert.match(conversationStartMemory.conversationalContext, /Internal continuity context for Dani/);
  assert.match(conversationStartMemory.conversationalContext, /Prior context summary:/);
  assert.equal(conversationStartMemory.conversationalContext.includes(normalizedFixtureEmail), false);
  assert.equal(conversationStartMemory.conversationalContext.includes(fixture.email_identity_hash), false);
  assert.equal(conversationStartMemory.conversationalContext.includes("xagents/"), false);

  const routeSource = await readFile("app/api/xagent/email-memory-lookup/dry-run/route.ts", "utf8");
  assert.match(routeSource, /buildGatedEmailMemoryLookupDryRunResponse/);
  assert.match(routeSource, /buildSafeEmailMemoryLookupUnavailableResponse/);
  assert.match(routeSource, /status: 400/);
  assert.equal(routeSource.includes("createConversation"), false);
  assert.equal(routeSource.includes("tavusapi.com"), false);
  assert.equal(routeSource.includes("Resend"), false);

  const normalStartRoute = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.equal(normalStartRoute.includes("emailIdentityMemoryLookup"), false);
  assert.equal(normalStartRoute.includes("email-memory-lookup"), false);

  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(
    packageJson.scripts["test:hermes-email-memory-lookup-t36"],
    "node tests/hermes-email-memory-lookup-t36.test.mjs",
  );

  console.log("Hermes email memory lookup T36 checks passed");
}

await main();
