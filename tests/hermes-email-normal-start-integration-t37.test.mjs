import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import emailFixture from "./fixtures/hermes-email-memory-lookup-dani.json" with { type: "json" };
import normalMemoryFixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import returnCodeFixture from "./fixtures/hermes-return-code-memory-lookup-dani.json" with { type: "json" };
import {
  DANI_TAVUS_CUSTOM_GREETING,
  buildCreateConversationBody,
} from "../lib/tavusCreateConversationBody.mjs";
import {
  buildInvalidMemoryContextValidationResponse,
  safeConversationStartMemoryFlags,
} from "../lib/xagent/conversationStartMemoryContext.mjs";
import {
  areServerSideMemoryContextResolverGatesOpen,
  maybeResolveServerSideMemoryContextForStart,
} from "../lib/xagent/serverSideMemoryContextResolver.mjs";
import { buildDaniConversationStartResponse } from "../lib/xagent/sessionIdentity.mjs";

const validFixtureEmail = "  DANI.Email.Identity.Fixture@Example.Invalid  ";
const normalizedFixtureEmail = "dani.email.identity.fixture@example.invalid";
const injectionOpen = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
};
const normalSiteOpen = {
  ...injectionOpen,
  XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const emailOpen = {
  ...injectionOpen,
  XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const returnCodeOpen = {
  ...injectionOpen,
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const allMemoryOpen = {
  ...normalSiteOpen,
  ...returnCodeOpen,
  ...emailOpen,
};
const tavusConfig = {
  personaId: "persona_email_start_test",
  replicaId: "replica_email_start_test",
  maxCallSeconds: 720,
  absentTimeout: 30,
  leftTimeout: 5,
};
const routeIdentity = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_email_route_test_001",
  session_id: "xagent_session_email_route_test_001",
  provider: "tavus",
};
const forbiddenResponseSubstrings = [
  validFixtureEmail.trim(),
  normalizedFixtureEmail,
  emailFixture.email_identity_hash,
  emailFixture.identity_salt_fixture_only,
  emailFixture.memory_context.recalled_memory_summary,
  "Internal continuity context for Dani",
  "candidate_tavus_prompt_context",
  "recalled_memory_summary",
  "email_identity_hash",
  "identity_salt_fixture_only",
  "memory_namespace",
  "visitor_memory_namespace",
  "summary_hash",
  "source_transcript_hash",
  "redacted_transcript_hash",
  "provider_conversation_id\":\"tavus_email_identity_fixture_conv_001",
  "hxeimc_",
  "hxeils_",
  "hxeior_",
  "xagents/",
  "transcript",
  "messages",
  "content",
  "TAVUS_API_KEY",
];

function assertPromptExcludesEmailIdentityData(prompt) {
  const forbiddenSubstrings = [
    normalizedFixtureEmail,
    emailFixture.email_identity_hash,
    emailFixture.identity_salt_fixture_only,
    "hxeimc_",
    "hxeils_",
    "hxeior_",
    "xagents/",
    "tavus_email_identity_fixture_conv_001",
    "755f1f14977e5a3e37db68d4bbdf68a1f88e3a6324344d96626b61833128dab8",
    "66a2bb19da1cef60c2c55c514715d555107a94abce59407bbed48f98a7c1cc47",
    "d878af165830e16bb5ae91d1dbaf06412094e849cdf07902a9def331722e21da",
    "record_hash",
    "summary_hash",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(prompt.includes(forbidden), false, `prompt leaked ${forbidden}`);
  }
}

function assertSerializedResponseExcludesEmailMemoryData(value) {
  const serialized = JSON.stringify(value);
  const forbiddenKeys = new Set([
    "memory_context",
    "memoryContext",
    "candidate_tavus_prompt_context",
    "recalled_memory_summary",
    "email",
    "returning_email",
    "returningEmail",
    "email_identity_hash",
    "identity_salt_fixture_only",
    "transcript",
    "messages",
    "content",
    "provenance",
    "summary_hash",
    "record_hash",
  ]);

  function walk(child) {
    if (Array.isArray(child)) {
      child.forEach(walk);
      return;
    }
    if (!child || typeof child !== "object") return;
    for (const [key, nested] of Object.entries(child)) {
      assert.equal(forbiddenKeys.has(key), false, `response included unsafe field ${key}`);
      walk(nested);
    }
  }

  walk(value);
  for (const forbidden of forbiddenResponseSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `response leaked ${forbidden}`);
  }
}

async function assertNoServiceCalls(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("email normal-start integration tests must not call live services");
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
  assert.equal(areServerSideMemoryContextResolverGatesOpen(emailOpen), false);

  const closedEmailLookup = await assertNoServiceCalls(() => maybeResolveServerSideMemoryContextForStart(
    { email: validFixtureEmail },
    { env: normalSiteOpen, memoryContext: normalMemoryFixture },
  ));
  assert.equal(closedEmailLookup, undefined);

  const openEmailLookup = await assertNoServiceCalls(() => maybeResolveServerSideMemoryContextForStart(
    { email: validFixtureEmail },
    { env: emailOpen, emailMemoryFixture: emailFixture },
  ));
  assert.equal(openEmailLookup.memory_context_requested, true);
  assert.equal(openEmailLookup.memory_context_applied, true);
  assert.equal(openEmailLookup.tavus_conversational_context_attached, true);
  assert.equal(openEmailLookup.server_side_memory_context_resolved, true);
  assert.equal(openEmailLookup.server_side_memory_context_source, "email_identity_local_fixture");
  assert.equal(openEmailLookup.email_identity_memory_lookup_used, true);
  assert.match(openEmailLookup.conversationalContext, /Internal continuity context for Dani/);
  assert.match(openEmailLookup.conversationalContext, /Prior context summary:/);
  assert.match(openEmailLookup.conversationalContext, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assertPromptExcludesEmailIdentityData(openEmailLookup.conversationalContext);

  const camelCaseEmailLookup = await maybeResolveServerSideMemoryContextForStart(
    { returningEmail: validFixtureEmail },
    { env: emailOpen, emailMemoryFixture: emailFixture },
  );
  assert.equal(camelCaseEmailLookup.server_side_memory_context_source, "email_identity_local_fixture");

  const snakeCaseEmailLookup = await maybeResolveServerSideMemoryContextForStart(
    { returning_email: validFixtureEmail },
    { env: emailOpen, emailMemoryFixture: emailFixture },
  );
  assert.equal(snakeCaseEmailLookup.server_side_memory_context_source, "email_identity_local_fixture");

  const emailWithNormalGates = await maybeResolveServerSideMemoryContextForStart(
    { email: validFixtureEmail },
    { env: allMemoryOpen, memoryContext: normalMemoryFixture, emailMemoryFixture: emailFixture },
  );
  assert.equal(emailWithNormalGates.server_side_memory_context_source, "email_identity_local_fixture");

  const noBodyWithNormalGates = await maybeResolveServerSideMemoryContextForStart(
    {},
    { env: allMemoryOpen, memoryContext: normalMemoryFixture },
  );
  assert.equal(noBodyWithNormalGates.server_side_memory_context_source, "local_fixture");

  const returnCodeWinsWhenBothSupplied = await maybeResolveServerSideMemoryContextForStart(
    { return_code: returnCodeFixture.return_code, email: validFixtureEmail },
    { env: allMemoryOpen, memoryContext: normalMemoryFixture, emailMemoryFixture: emailFixture },
  );
  assert.equal(returnCodeWinsWhenBothSupplied.server_side_memory_context_source, "return_code_local_fixture");
  assert.equal(returnCodeWinsWhenBothSupplied.return_code_memory_lookup_used, true);

  await assert.rejects(
    () => maybeResolveServerSideMemoryContextForStart(
      { email: "not an email" },
      { env: emailOpen, emailMemoryFixture: emailFixture },
    ),
    /basic valid email shape/,
  );
  const unknownEmailStartsFresh = await maybeResolveServerSideMemoryContextForStart(
    { email: "unknown@example.invalid" },
    { env: emailOpen, emailMemoryFixture: emailFixture },
  );
  assert.equal(unknownEmailStartsFresh.memory_context_requested, false);
  assert.equal(unknownEmailStartsFresh.memory_context_applied, false);
  assert.equal(unknownEmailStartsFresh.tavus_conversational_context_attached, false);
  assert.equal(unknownEmailStartsFresh.server_side_memory_context_source, "email_identity_no_approved_memory_found");

  const mockedTavusBodies = [];
  const mockedCreateConversation = async (callbackUrl, options = {}) => {
    const body = buildCreateConversationBody(tavusConfig, {
      callbackUrl,
      conversationalContext: options.conversationalContext,
    });
    mockedTavusBodies.push(body);
    return {
      conversation_url: "https://daily.example/email-route-test",
      conversation_id: "tavus_email_conversation_test_001",
    };
  };

  const data = await mockedCreateConversation("https://preview.invalid/api/webhook", {
    conversationalContext: openEmailLookup.conversationalContext,
  });
  const response = {
    ...buildDaniConversationStartResponse(data, 1234567890, routeIdentity),
    ...safeConversationStartMemoryFlags(openEmailLookup),
  };
  const tavusBody = mockedTavusBodies.at(-1);
  assert.match(tavusBody.conversational_context, /Internal continuity context for Dani/);
  assertPromptExcludesEmailIdentityData(tavusBody.conversational_context);
  assert.equal(tavusBody.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);
  assert.equal(tavusBody.custom_greeting.includes("Internal continuity context"), false);
  assert.equal(Object.hasOwn(tavusBody, "memory_stores"), false);
  assert.equal(response.memory_context_requested, true);
  assert.equal(response.memory_context_applied, true);
  assert.equal(response.tavus_conversational_context_attached, true);
  assertSerializedResponseExcludesEmailMemoryData(response);

  const createConversationCallsBeforeInvalid = mockedTavusBodies.length;
  await assert.rejects(
    () => maybeResolveServerSideMemoryContextForStart(
      { returning_email: "bad value" },
      { env: emailOpen, emailMemoryFixture: emailFixture },
    ),
    /basic valid email shape/,
  );
  assert.equal(mockedTavusBodies.length, createConversationCallsBeforeInvalid);

  const invalidMemoryValidationResponse = buildInvalidMemoryContextValidationResponse();
  assert.deepEqual(invalidMemoryValidationResponse, {
    memory_context_requested: true,
    memory_context_applied: false,
    tavus_conversational_context_attached: false,
    tavus_create_conversation_called: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    outbound_action_taken: false,
  });
  assertSerializedResponseExcludesEmailMemoryData(invalidMemoryValidationResponse);

  const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
  assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start'/);
  assert.match(tavusPlayerSource, /JSON\.stringify\(startPayload\)/);
  assert.match(tavusPlayerSource, /email/);
  assert.match(tavusPlayerSource, /skip_memory/);
  assert.equal(tavusPlayerSource.includes("returning_email"), false);
  assert.equal(tavusPlayerSource.includes("memory_context"), false);

  const routeSource = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.match(routeSource, /maybeResolveServerSideMemoryContextForStart/);
  assert.match(routeSource, /status: 400/);
  assert.match(routeSource, /conversationalContext: memoryContext\.conversationalContext/);
  assert.equal(routeSource.includes("memory_stores"), false);
  assert.equal(routeSource.includes("custom_greeting"), false);
  assert.equal(routeSource.includes("raw_email"), false);

  const resolverSource = await readFile("lib/xagent/serverSideMemoryContextResolver.mjs", "utf8");
  assert.match(resolverSource, /resolveEmailMemoryContext/);
  assert.match(resolverSource, /areEmailMemoryLookupGatesOpen/);
  assert.match(resolverSource, /email_identity_local_fixture/);
  assert.match(resolverSource, /return_code_local_fixture/);

  const doc = await readFile("docs/HERMES_EMAIL_NORMAL_START_INTEGRATION_T37.md", "utf8");
  assert.match(doc, /email/);
  assert.match(doc, /returning_email/);
  assert.match(doc, /returningEmail/);
  assert.match(doc, /If email gates are closed, supplied email is ignored/);
  assert.match(doc, /Memory is not placed in `custom_greeting`|memory is not placed in `custom_greeting`/);
  assert.equal(doc.includes(normalizedFixtureEmail), false);
  assert.equal(doc.includes(emailFixture.email_identity_hash), false);
  assert.equal(doc.includes(emailFixture.memory_context.recalled_memory_summary), false);
  assert.equal(doc.includes("xagents/ai-fusion-labs/dani/email/"), false);

  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(
    packageJson.scripts["test:hermes-email-normal-start-integration-t37"],
    "node tests/hermes-email-normal-start-integration-t37.test.mjs",
  );

  console.log("Hermes email normal-start integration T37 checks passed");
}

await main();
