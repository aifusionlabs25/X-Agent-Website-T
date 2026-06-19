import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  DANI_TAVUS_CUSTOM_GREETING,
  buildCreateConversationBody,
} from "../lib/tavusCreateConversationBody.mjs";
import {
  buildConversationStartMemoryContextForRequestBody,
  buildInvalidMemoryContextValidationResponse,
  safeConversationStartMemoryFlags,
} from "../lib/xagent/conversationStartMemoryContext.mjs";
import { buildDaniConversationStartResponse } from "../lib/xagent/sessionIdentity.mjs";

const openGates = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
};
const tavusConfig = {
  personaId: "persona_start_test",
  replicaId: "replica_start_test",
  maxCallSeconds: 120,
  absentTimeout: 30,
  leftTimeout: 5,
};
const routeIdentity = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_route_test_001",
  session_id: "xagent_session_route_test_001",
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
    "candidate_tavus_prompt_context",
    "recalled_memory_summary",
    "memory_namespace",
    "visitor_memory_namespace",
    "record_hash",
    "summary_hash",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `response leaked ${forbidden}`);
  }
}

async function main() {
  const bodyWithoutMemory = buildCreateConversationBody(tavusConfig, {
    callbackUrl: "https://preview.invalid/api/webhook",
  });
  assert.equal(Object.hasOwn(bodyWithoutMemory, "conversational_context"), false);
  assert.equal(Object.hasOwn(bodyWithoutMemory, "memory_stores"), false);
  assert.equal(bodyWithoutMemory.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);

  const bodyWithMemory = buildCreateConversationBody(tavusConfig, {
    callbackUrl: "https://preview.invalid/api/webhook",
    conversationalContext: "Internal continuity context for Dani.",
  });
  assert.equal(bodyWithMemory.conversational_context, "Internal continuity context for Dani.");
  assert.equal(bodyWithMemory.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);
  assert.equal(Object.hasOwn(bodyWithMemory, "memory_stores"), false);

  const mockedTavusBodies = [];
  const mockedCreateConversation = async (callbackUrl, options = {}) => {
    const body = buildCreateConversationBody(tavusConfig, {
      callbackUrl,
      conversationalContext: options.conversationalContext,
    });
    mockedTavusBodies.push(body);
    return {
      conversation_url: "https://daily.example/tavus-route-test",
      conversation_id: "tavus_route_conversation_test_001",
    };
  };

  const closedMemoryContext = buildConversationStartMemoryContextForRequestBody(
    { memory_context: clone(fixture) },
    { env: {} },
  );
  const closedData = await mockedCreateConversation("https://preview.invalid/api/webhook", {
    conversationalContext: closedMemoryContext.conversationalContext,
  });
  const closedResponse = {
    ...buildDaniConversationStartResponse(closedData, 1234567890, routeIdentity),
    ...safeConversationStartMemoryFlags(closedMemoryContext),
  };

  assert.equal(closedMemoryContext.conversationalContext, undefined);
  assert.equal(closedResponse.conversation_url, "https://daily.example/tavus-route-test");
  assert.equal(closedResponse.provider_conversation_id, "tavus_route_conversation_test_001");
  assert.equal(closedResponse.memory_context_requested, false);
  assert.equal(closedResponse.memory_context_applied, false);
  assert.equal(closedResponse.tavus_conversational_context_attached, false);
  assert.equal(Object.hasOwn(mockedTavusBodies.at(-1), "conversational_context"), false);
  assert.equal(Object.hasOwn(mockedTavusBodies.at(-1), "memory_stores"), false);

  const openMemoryContext = buildConversationStartMemoryContextForRequestBody(
    { memory_context: clone(fixture) },
    { env: openGates },
  );
  const openData = await mockedCreateConversation("https://preview.invalid/api/webhook", {
    conversationalContext: openMemoryContext.conversationalContext,
  });
  const openResponse = {
    ...buildDaniConversationStartResponse(openData, 1234567890, routeIdentity),
    ...safeConversationStartMemoryFlags(openMemoryContext),
  };
  const openBody = mockedTavusBodies.at(-1);

  assert.equal(openMemoryContext.memory_context_requested, true);
  assert.equal(openMemoryContext.memory_context_applied, true);
  assert.equal(openMemoryContext.tavus_conversational_context_attached, true);
  assert.match(openBody.conversational_context, /Internal continuity context for Dani/);
  assert.match(openBody.conversational_context, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assertPromptExcludesBackendData(openBody.conversational_context);
  assert.equal(openBody.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);
  assert.equal(openBody.custom_greeting.includes("Internal continuity context"), false);
  assert.equal(Object.hasOwn(openBody, "memory_stores"), false);
  assert.equal(openResponse.memory_context_requested, true);
  assert.equal(openResponse.memory_context_applied, true);
  assert.equal(openResponse.tavus_conversational_context_attached, true);
  assertSerializedResponseExcludesMemoryData(openResponse);

  const callsBeforeInvalid = mockedTavusBodies.length;
  assert.throws(
    () => buildConversationStartMemoryContextForRequestBody(
      { memory_context: { ...clone(fixture), agent_slug: "james" } },
      { env: openGates },
    ),
    /agent_slug must be dani/,
  );
  assert.equal(mockedTavusBodies.length, callsBeforeInvalid);

  assert.throws(
    () => buildConversationStartMemoryContextForRequestBody(
      { memory_context: { ...clone(fixture), outbound_action_taken: true } },
      { env: openGates },
    ),
    /\$\.outbound_action_taken must be false/,
  );
  assert.equal(mockedTavusBodies.length, callsBeforeInvalid);

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
  assert.equal(mockedTavusBodies.length, callsBeforeInvalid);

  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    throw new Error("T16 tests must not call live fetch");
  };
  try {
    buildConversationStartMemoryContextForRequestBody({ memory_context: clone(fixture) }, { env: openGates });
    assert.deepEqual(fetchCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const routeSource = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.match(routeSource, /areConversationStartMemoryContextGatesOpen/);
  assert.match(routeSource, /buildConversationStartMemoryContextForRequestBody/);
  assert.match(routeSource, /buildInvalidMemoryContextValidationResponse/);
  assert.match(routeSource, /status: 400/);
  assert.match(routeSource, /conversationalContext: memoryContext\.conversationalContext/);
  assert.equal(routeSource.includes("memory_stores"), false);
  assert.equal(routeSource.includes("custom_greeting"), false);

  console.log("Hermes Tavus conversation-start memory injection checks passed");
}

await main();
