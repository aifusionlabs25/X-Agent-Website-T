import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  DANI_TAVUS_CUSTOM_GREETING,
  buildCreateConversationBody,
} from "../lib/tavusCreateConversationBody.mjs";
import {
  buildConversationStartMemoryContextForRequestBody,
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
const tavusConfig = {
  personaId: "persona_normal_site_test",
  replicaId: "replica_normal_site_test",
  maxCallSeconds: 720,
  absentTimeout: 30,
  leftTimeout: 5,
};
const routeIdentity = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_normal_site_test_001",
  session_id: "xagent_session_normal_site_test_001",
  provider: "tavus",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
  const forbiddenSubstrings = [
    fixture.recalled_memory_summary,
    "Internal continuity context for Dani",
    "candidate_tavus_prompt_context",
    "recalled_memory_summary",
    "memory_namespace",
    "visitor_memory_namespace",
    "record_hash",
    "summary_hash",
    "hxmr_",
    "hxmc_",
    "hxls_",
    "hxor_",
    "xagents/",
    "ca4ec4813b2a8413",
    "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `response leaked ${forbidden}`);
  }
}

async function assertNoServiceCalls(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("normal-site server-side memory injection tests must not call live services");
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
  assert.equal(areServerSideMemoryContextResolverGatesOpen({}), false);
  assert.equal(areServerSideMemoryContextResolverGatesOpen(injectionOpen), false);
  assert.equal(areServerSideMemoryContextResolverGatesOpen({
    ...normalSiteOpen,
    XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH: "true",
  }), false);
  assert.equal(areServerSideMemoryContextResolverGatesOpen(normalSiteOpen), true);

  const closedLookup = await maybeResolveServerSideMemoryContextForStart({}, {
    env: injectionOpen,
  });
  assert.equal(closedLookup, undefined);

  const noMemoryContext = buildConversationStartMemoryContextForRequestBody({}, { env: injectionOpen });
  assert.equal(noMemoryContext.memory_context_requested, false);
  assert.equal(noMemoryContext.memory_context_applied, false);
  assert.equal(noMemoryContext.tavus_conversational_context_attached, false);
  assert.equal(noMemoryContext.conversationalContext, undefined);

  const serverSideMemoryContext = await assertNoServiceCalls(() => maybeResolveServerSideMemoryContextForStart({}, {
    env: normalSiteOpen,
    memoryContext: clone(fixture),
  }));
  assert.equal(serverSideMemoryContext.memory_context_requested, true);
  assert.equal(serverSideMemoryContext.memory_context_applied, true);
  assert.equal(serverSideMemoryContext.tavus_conversational_context_attached, true);
  assert.equal(serverSideMemoryContext.server_side_memory_context_resolved, true);
  assert.equal(serverSideMemoryContext.server_side_memory_context_source, "local_fixture");
  assert.match(serverSideMemoryContext.conversationalContext, /Internal continuity context for Dani/);
  assert.match(serverSideMemoryContext.conversationalContext, /Prior context summary:/);
  assert.match(serverSideMemoryContext.conversationalContext, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assertPromptExcludesBackendData(serverSideMemoryContext.conversationalContext);

  const suppliedBodyContext = await maybeResolveServerSideMemoryContextForStart(
    { memory_context: clone(fixture) },
    { env: normalSiteOpen },
  );
  assert.equal(suppliedBodyContext, undefined);

  const mockedTavusBodies = [];
  const mockedCreateConversation = async (callbackUrl, options = {}) => {
    const body = buildCreateConversationBody(tavusConfig, {
      callbackUrl,
      conversationalContext: options.conversationalContext,
    });
    mockedTavusBodies.push(body);
    return {
      conversation_url: "https://daily.example/normal-site-route-test",
      conversation_id: "tavus_normal_site_conversation_test_001",
    };
  };

  const closedData = await mockedCreateConversation("https://preview.invalid/api/webhook", {
    conversationalContext: noMemoryContext.conversationalContext,
  });
  const closedResponse = {
    ...buildDaniConversationStartResponse(closedData, 1234567890, routeIdentity),
    ...safeConversationStartMemoryFlags(noMemoryContext),
  };
  assert.equal(Object.hasOwn(mockedTavusBodies.at(-1), "conversational_context"), false);
  assert.equal(closedResponse.memory_context_requested, false);
  assert.equal(closedResponse.memory_context_applied, false);
  assert.equal(closedResponse.tavus_conversational_context_attached, false);

  const openData = await mockedCreateConversation("https://preview.invalid/api/webhook", {
    conversationalContext: serverSideMemoryContext.conversationalContext,
  });
  const openResponse = {
    ...buildDaniConversationStartResponse(openData, 1234567890, routeIdentity),
    ...safeConversationStartMemoryFlags(serverSideMemoryContext),
  };
  const openBody = mockedTavusBodies.at(-1);
  assert.match(openBody.conversational_context, /Internal continuity context for Dani/);
  assert.equal(openBody.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);
  assert.equal(openBody.custom_greeting.includes("Internal continuity context"), false);
  assert.equal(Object.hasOwn(openBody, "memory_stores"), false);
  assert.equal(openResponse.memory_context_requested, true);
  assert.equal(openResponse.memory_context_applied, true);
  assert.equal(openResponse.tavus_conversational_context_attached, true);
  assertSerializedResponseExcludesMemoryData(openResponse);

  const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
  assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start'/);
  assert.match(tavusPlayerSource, /skip_memory/);
  assert.equal(tavusPlayerSource.includes("memory_context"), false);
  assert.match(tavusPlayerSource, /JSON\.stringify\(startPayload\)/);

  const routeSource = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.match(routeSource, /maybeResolveServerSideMemoryContextForStart/);
  assert.match(routeSource, /readOptionalJsonBody/);
  assert.match(routeSource, /buildConversationStartMemoryContextForRequestBody/);
  assert.match(routeSource, /conversationalContext: memoryContext\.conversationalContext/);
  assert.equal(routeSource.includes("memory_stores"), false);
  assert.equal(routeSource.includes("custom_greeting"), false);

  console.log("Hermes normal-site server-side memory injection T24 checks passed");
}

await main();
