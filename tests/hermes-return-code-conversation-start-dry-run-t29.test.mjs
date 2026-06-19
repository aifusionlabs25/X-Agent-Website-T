import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import returnCodeFixture from "./fixtures/hermes-return-code-memory-lookup-dani.json" with { type: "json" };
import memoryFixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  buildReturnCodeConversationStartDryRunResponse,
  buildSafeReturnCodeConversationStartDryRunRejectedResponse,
} from "../lib/xagent/returnCodeConversationStartDryRun.mjs";

const openGates = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const missingReturnCodeGates = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
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
  "provider_conversation_id",
  "conversation_url",
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
  "TAVUS_API_KEY",
  "transcript",
  "messages",
  "content",
];

function assertNoUnsafeResponseLeak(response) {
  const serialized = JSON.stringify(response);
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
    "conversation_url",
    "provider_conversation_id",
  ]);

  function walk(value) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `dry-run response included unsafe field ${key}`);
      walk(child);
    }
  }

  walk(response);
  for (const forbidden of forbiddenResponseSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `dry-run response leaked ${forbidden}`);
  }
}

async function assertNoServiceCalls(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("return-code conversation-start dry-run tests must not call live services");
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
  const disabled = buildSafeReturnCodeConversationStartDryRunRejectedResponse(
    { return_code: returnCodeFixture.return_code },
    { env: {} },
  );
  assert.equal(disabled.return_code_supplied, true);
  assert.equal(disabled.return_code_valid, false);
  assert.equal(disabled.memory_injection_gates_open, false);
  assert.equal(disabled.return_code_memory_lookup_gates_open, false);
  assert.equal(disabled.memory_context_requested, true);
  assert.equal(disabled.server_side_memory_lookup_attempted, false);
  assert.equal(disabled.server_side_memory_context_applied, false);
  assert.equal(disabled.tavus_conversational_context_attached, false);
  assert.equal(disabled.tavus_create_conversation_called, false);
  assertNoUnsafeResponseLeak(disabled);

  await assert.rejects(
    () => assertNoServiceCalls(() => buildReturnCodeConversationStartDryRunResponse(
      { return_code: returnCodeFixture.return_code },
      { env: {} },
    )),
    /memory injection gates must be open/,
  );
  await assert.rejects(
    () => assertNoServiceCalls(() => buildReturnCodeConversationStartDryRunResponse(
      { return_code: returnCodeFixture.return_code },
      { env: missingReturnCodeGates },
    )),
    /return-code memory lookup gates must be open/,
  );
  await assert.rejects(
    () => assertNoServiceCalls(() => buildReturnCodeConversationStartDryRunResponse(
      {},
      { env: openGates },
    )),
    /return_code is required/,
  );
  await assert.rejects(
    () => assertNoServiceCalls(() => buildReturnCodeConversationStartDryRunResponse(
      { return_code: "DANI-RET-AAAA-AAAA-AAAA" },
      { env: openGates },
    )),
    /return_code was not found/,
  );

  const valid = await assertNoServiceCalls(() => buildReturnCodeConversationStartDryRunResponse(
    { returnCode: returnCodeFixture.return_code },
    { env: openGates },
  ));
  assert.deepEqual(valid, {
    dry_run_only: true,
    internal_route_only: true,
    return_code_conversation_start_dry_run: true,
    return_code_supplied: true,
    return_code_valid: true,
    agent_slug: "dani",
    tenant_id: "ai-fusion-labs",
    memory_injection_gates_open: true,
    return_code_memory_lookup_gates_open: true,
    memory_context_requested: true,
    memory_context_applied: false,
    server_side_memory_lookup_attempted: true,
    server_side_memory_context_applied: true,
    tavus_conversational_context_attached: true,
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
  });
  assertNoUnsafeResponseLeak(valid);

  const routeSource = await readFile("app/api/xagent/return-code-conversation-start/dry-run/route.ts", "utf8");
  assert.match(routeSource, /buildReturnCodeConversationStartDryRunResponse/);
  assert.match(routeSource, /buildSafeReturnCodeConversationStartDryRunRejectedResponse/);
  assert.match(routeSource, /status: 400/);
  assert.equal(routeSource.includes("createConversation"), false);
  assert.equal(routeSource.includes("tavusapi.com"), false);
  assert.equal(routeSource.includes("Resend"), false);
  assert.equal(routeSource.includes("memory_stores"), false);
  assert.equal(routeSource.includes("custom_greeting"), false);

  const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
  assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
  assert.equal(tavusPlayerSource.includes("return_code"), false);
  assert.equal(tavusPlayerSource.includes("memory_context"), false);
  assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

  console.log("Hermes return-code conversation-start dry-run T29 checks passed");
}

await main();
