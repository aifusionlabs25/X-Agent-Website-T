import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import returnCodeFixture from "./fixtures/hermes-return-code-memory-lookup-dani.json" with { type: "json" };
import memoryFixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
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
const returnCodeOpen = {
  ...injectionOpen,
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const allMemoryOpen = {
  ...normalSiteOpen,
  ...returnCodeOpen,
};
const tavusConfig = {
  personaId: "persona_return_code_start_test",
  replicaId: "replica_return_code_start_test",
  maxCallSeconds: 120,
  absentTimeout: 30,
  leftTimeout: 5,
};
const routeIdentity = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_return_code_route_test_001",
  session_id: "xagent_session_return_code_route_test_001",
  provider: "tavus",
};
const forbiddenResponseSubstrings = [
  memoryFixture.recalled_memory_summary,
  "Internal continuity context for Dani",
  "candidate_tavus_prompt_context",
  "recalled_memory_summary",
  "memory_namespace",
  "visitor_memory_namespace",
  "record_hash",
  "summary_hash",
  "source_transcript_hash",
  "redacted_transcript_hash",
  "provider_conversation_id\":\"ca4ec4813b2a8413",
  "hxmr_",
  "hxmc_",
  "hxls_",
  "hxor_",
  "xagents/",
  "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
  "438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40",
  "e1c4bbfaada0a252ac67262b208950d8a3c8cbf2919505d2f958369194da1814",
  "c7355949b0cb28af3ef04f21e5cd7b8962744f93611fd9662194a629b8ed5493",
  "visitor_manual_live_tavus_test",
  "xagent_session_memory_recall_preview_001",
  "xagent_session_manual_live_tavus_test",
  "TAVUS_API_KEY",
  "transcript",
  "messages",
  "content",
];

function assertPromptExcludesBackendData(prompt) {
  const forbiddenSubstrings = [
    "hxmr_",
    "hxmc_",
    "hxls_",
    "hxor_",
    "xagents/",
    "ca4ec4813b2a8413",
    "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
    "438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40",
    "e1c4bbfaada0a252ac67262b208950d8a3c8cbf2919505d2f958369194da1814",
    "c7355949b0cb28af3ef04f21e5cd7b8962744f93611fd9662194a629b8ed5493",
    "visitor_manual_live_tavus_test",
    "xagent_session_memory_recall_preview_001",
    "xagent_session_manual_live_tavus_test",
    "record_hash",
    "summary_hash",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(prompt.includes(forbidden), false, `prompt leaked ${forbidden}`);
  }
}

function assertSerializedResponseExcludesMemoryData(value) {
  const serialized = JSON.stringify(value);
  const forbiddenKeys = new Set([
    "memory_context",
    "memoryContext",
    "candidate_tavus_prompt_context",
    "recalled_memory_summary",
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
    throw new Error("return-code normal-start integration tests must not call live services");
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
  assert.equal(areServerSideMemoryContextResolverGatesOpen(returnCodeOpen), false);

  const noReturnCodeNormalLookup = await assertNoServiceCalls(() => maybeResolveServerSideMemoryContextForStart({}, {
    env: normalSiteOpen,
    memoryContext: memoryFixture,
  }));
  assert.equal(noReturnCodeNormalLookup.server_side_memory_context_source, "local_fixture");
  assert.equal(noReturnCodeNormalLookup.memory_context_applied, true);

  const closedReturnCodeLookup = await assertNoServiceCalls(() => maybeResolveServerSideMemoryContextForStart(
    { return_code: returnCodeFixture.return_code },
    { env: normalSiteOpen, memoryContext: memoryFixture },
  ));
  assert.equal(closedReturnCodeLookup, undefined);

  const openReturnCodeLookup = await assertNoServiceCalls(() => maybeResolveServerSideMemoryContextForStart(
    { return_code: returnCodeFixture.return_code },
    { env: returnCodeOpen },
  ));
  assert.equal(openReturnCodeLookup.memory_context_requested, true);
  assert.equal(openReturnCodeLookup.memory_context_applied, true);
  assert.equal(openReturnCodeLookup.tavus_conversational_context_attached, true);
  assert.equal(openReturnCodeLookup.server_side_memory_context_resolved, true);
  assert.equal(openReturnCodeLookup.server_side_memory_context_source, "return_code_local_fixture");
  assert.equal(openReturnCodeLookup.return_code_memory_lookup_used, true);
  assert.match(openReturnCodeLookup.conversationalContext, /Internal continuity context for Dani/);
  assert.match(openReturnCodeLookup.conversationalContext, /Prior context summary:/);
  assert.match(openReturnCodeLookup.conversationalContext, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assertPromptExcludesBackendData(openReturnCodeLookup.conversationalContext);

  const openReturnCodeWithNormalGates = await maybeResolveServerSideMemoryContextForStart(
    { return_code: returnCodeFixture.return_code },
    { env: allMemoryOpen, memoryContext: memoryFixture },
  );
  assert.equal(openReturnCodeWithNormalGates.server_side_memory_context_source, "return_code_local_fixture");

  await assert.rejects(
    () => maybeResolveServerSideMemoryContextForStart(
      { return_code: "DANI-RET-AAAA-AAAA-AAAA" },
      { env: returnCodeOpen },
    ),
    /return_code was not found/,
  );

  const mockedTavusBodies = [];
  const mockedCreateConversation = async (callbackUrl, options = {}) => {
    const body = buildCreateConversationBody(tavusConfig, {
      callbackUrl,
      conversationalContext: options.conversationalContext,
    });
    mockedTavusBodies.push(body);
    return {
      conversation_url: "https://daily.example/return-code-route-test",
      conversation_id: "tavus_return_code_conversation_test_001",
    };
  };

  const data = await mockedCreateConversation("https://preview.invalid/api/webhook", {
    conversationalContext: openReturnCodeLookup.conversationalContext,
  });
  const response = {
    ...buildDaniConversationStartResponse(data, 1234567890, routeIdentity),
    ...safeConversationStartMemoryFlags(openReturnCodeLookup),
  };
  const tavusBody = mockedTavusBodies.at(-1);
  assert.match(tavusBody.conversational_context, /Internal continuity context for Dani/);
  assertPromptExcludesBackendData(tavusBody.conversational_context);
  assert.equal(tavusBody.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);
  assert.equal(tavusBody.custom_greeting.includes("Internal continuity context"), false);
  assert.equal(Object.hasOwn(tavusBody, "memory_stores"), false);
  assert.equal(response.memory_context_requested, true);
  assert.equal(response.memory_context_applied, true);
  assert.equal(response.tavus_conversational_context_attached, true);
  assertSerializedResponseExcludesMemoryData(response);

  const createConversationCallsBeforeInvalid = mockedTavusBodies.length;
  await assert.rejects(
    () => maybeResolveServerSideMemoryContextForStart(
      { return_code: "DANI-RET-K7P4-M9Q2-T6V0" },
      { env: returnCodeOpen },
    ),
    /unsupported characters/,
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
  assertSerializedResponseExcludesMemoryData(invalidMemoryValidationResponse);

  const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
  assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
  assert.equal(tavusPlayerSource.includes("return_code"), false);
  assert.equal(tavusPlayerSource.includes("memory_context"), false);
  assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

  const routeSource = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.match(routeSource, /maybeResolveServerSideMemoryContextForStart/);
  assert.match(routeSource, /status: 400/);
  assert.match(routeSource, /conversationalContext: memoryContext\.conversationalContext/);
  assert.equal(routeSource.includes("memory_stores"), false);
  assert.equal(routeSource.includes("custom_greeting"), false);

  const resolverSource = await readFile("lib/xagent/serverSideMemoryContextResolver.mjs", "utf8");
  assert.match(resolverSource, /resolveReturnCodeMemoryContext/);
  assert.match(resolverSource, /areReturnCodeMemoryLookupGatesOpen/);
  assert.match(resolverSource, /return_code_local_fixture/);

  console.log("Hermes return-code normal-start integration T28 checks passed");
}

await main();
