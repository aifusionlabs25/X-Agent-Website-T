import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import lookupFixture from "./fixtures/hermes-return-code-memory-lookup-dani.json" with { type: "json" };
import memoryFixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  areReturnCodeMemoryLookupGatesOpen,
  buildGatedReturnCodeMemoryLookupDryRunResponse,
  buildReturnCodeMemoryLookupDryRunResponse,
  buildSafeReturnCodeMemoryLookupUnavailableResponse,
  generateDaniReturnCode,
  isDaniReturnCodeShape,
  normalizeDaniReturnCode,
  resolveReturnCodeMemoryContext,
} from "../lib/xagent/returnCodeMemoryLookup.mjs";
import { buildConversationStartMemoryContextForRequestBody } from "../lib/xagent/conversationStartMemoryContext.mjs";

const openLookupGates = {
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED: "true",
  XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
  XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH: "false",
};
const openTavusMemoryGates = {
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
  "hxmr_",
  "hxmc_",
  "hxls_",
  "hxor_",
  "xagents/",
  "ca4ec4813b2a8413",
  "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
  "438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40",
  "e1c4bbfaada0a252ac67262b2089505d2f958369194da1814",
  "c7355949b0cb28af3ef04f21e5cd7b8962744f93611fd9662194a629b8ed5493",
  "visitor_manual_live_tavus_test",
  "xagent_session_memory_recall_preview_001",
  "xagent_session_manual_live_tavus_test",
  "TAVUS_API_KEY",
  "transcript",
  "messages",
  "content",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
  ]);

  function walk(value) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `return-code response included unsafe field ${key}`);
      walk(child);
    }
  }

  walk(response);
  for (const forbidden of forbiddenResponseSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `return-code response leaked ${forbidden}`);
  }
}

async function assertNoServiceCalls(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("return-code memory lookup preview tests must not call live services");
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
  assert.equal(areReturnCodeMemoryLookupGatesOpen({}), false);
  assert.equal(areReturnCodeMemoryLookupGatesOpen({
    XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED: "true",
    XAGENT_DANI_RETURN_CODE_MEMORY_LOOKUP_PILOT_ENABLED: "true",
    XAGENT_RETURN_CODE_MEMORY_LOOKUP_KILL_SWITCH: "true",
  }), false);
  assert.equal(areReturnCodeMemoryLookupGatesOpen(openLookupGates), true);

  assert.match(generateDaniReturnCode({ randomIntImpl: () => 0 }), /^DANI-RET-AAAA-AAAA-AAAA$/);
  assert.equal(isDaniReturnCodeShape("DANI-RET-K7P4-M9Q2-T6VA"), true);
  assert.equal(normalizeDaniReturnCode("dani ret k7p4 m9q2 t6va"), "DANI-RET-K7P4-M9Q2-T6VA");
  assert.equal(isDaniReturnCodeShape("DANI-RET-K7P4-M9Q2-T6V0"), false);
  assert.equal(isDaniReturnCodeShape("hxmr_f016484b62254c09"), false);

  assert.throws(
    () => buildGatedReturnCodeMemoryLookupDryRunResponse({ return_code: lookupFixture.return_code }, { env: {} }),
    /XAGENT_RETURN_CODE_MEMORY_LOOKUP_ENABLED must be exactly true/,
  );

  const disabledResponse = buildSafeReturnCodeMemoryLookupUnavailableResponse();
  assert.equal(disabledResponse.return_code_lookup_preview_enabled, false);
  assert.equal(disabledResponse.return_code_valid, false);
  assert.equal(disabledResponse.memory_context_preview_available, false);
  assert.equal(disabledResponse.memory_context_applied, false);
  assertNoUnsafeResponseLeak(disabledResponse);

  const resolved = await assertNoServiceCalls(() => resolveReturnCodeMemoryContext({ return_code: lookupFixture.return_code }));
  assert.equal(resolved.return_code_valid, true);
  assert.equal(resolved.agent_slug, "dani");
  assert.equal(resolved.tenant_id, "ai-fusion-labs");
  assert.equal(resolved.lookup_source, "local_fixture_proof_store");
  assert.equal(resolved.local_fixture_only, true);
  assert.equal(resolved.memory_context.recalled_memory_summary, memoryFixture.recalled_memory_summary);
  assert.equal(resolved.session_start_memory_context_preview.memory_context_preview_enabled, true);
  assert.equal(resolved.session_start_memory_context_preview.production_memory_database_mutated, false);
  assert.equal(resolved.session_start_memory_context_preview.outbound_action_taken, false);

  const safeResponse = buildGatedReturnCodeMemoryLookupDryRunResponse(
    { return_code: lookupFixture.return_code },
    { env: openLookupGates },
  );
  assert.deepEqual(safeResponse, {
    dry_run_only: true,
    internal_route_only: true,
    return_code_lookup_preview_enabled: true,
    return_code_valid: true,
    agent_slug: "dani",
    tenant_id: "ai-fusion-labs",
    memory_context_preview_available: true,
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
    lookup_source: "local_fixture_proof_store",
    local_fixture_only: true,
  });
  assertNoUnsafeResponseLeak(safeResponse);

  assert.throws(
    () => buildReturnCodeMemoryLookupDryRunResponse({ return_code: "DANI-RET-AAAA-AAAA-AAAA" }),
    /return_code was not found/,
  );
  assert.throws(
    () => resolveReturnCodeMemoryContext({
      return_code: lookupFixture.return_code,
    }, {
      fixture: { ...clone(lookupFixture), agent_slug: "james" },
    }),
    /agent_slug must be dani/,
  );
  assert.throws(
    () => resolveReturnCodeMemoryContext({
      return_code: lookupFixture.return_code,
    }, {
      fixture: { ...clone(lookupFixture), production_database_mutated: true },
    }),
    /production_database_mutated must be false/,
  );
  assert.throws(
    () => resolveReturnCodeMemoryContext({
      return_code: lookupFixture.return_code,
    }, {
      fixture: { ...clone(lookupFixture), resend_called: true },
    }),
    /outbound flags must be false/,
  );

  const conversationStartMemory = buildConversationStartMemoryContextForRequestBody(
    { memory_context: resolved.memory_context },
    { env: openTavusMemoryGates },
  );
  assert.equal(conversationStartMemory.memory_context_requested, true);
  assert.equal(conversationStartMemory.memory_context_applied, true);
  assert.equal(conversationStartMemory.tavus_conversational_context_attached, true);
  assert.match(conversationStartMemory.conversationalContext, /Internal continuity context for Dani/);
  assert.match(conversationStartMemory.conversationalContext, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assert.equal(conversationStartMemory.conversationalContext.includes("hxmr_"), false);
  assert.equal(conversationStartMemory.conversationalContext.includes("xagents/"), false);

  const routeSource = await readFile("app/api/xagent/return-code-memory-lookup/dry-run/route.ts", "utf8");
  assert.match(routeSource, /buildGatedReturnCodeMemoryLookupDryRunResponse/);
  assert.match(routeSource, /buildSafeReturnCodeMemoryLookupUnavailableResponse/);
  assert.match(routeSource, /status: 400/);
  assert.equal(routeSource.includes("createConversation"), false);
  assert.equal(routeSource.includes("tavusapi.com"), false);
  assert.equal(routeSource.includes("Resend"), false);

  const normalStartRoute = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.equal(normalStartRoute.includes("returnCodeMemoryLookup"), false);
  assert.equal(normalStartRoute.includes("return-code-memory-lookup"), false);

  console.log("Hermes return-code memory lookup T27 checks passed");
}

await main();
