import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildXAgentRuntimeReadiness, XAGENT_RUNTIME_READINESS_VERSION } from "../lib/xagent/runtimeReadiness.mjs";

const closed = buildXAgentRuntimeReadiness({
  env: {},
  now: "2026-06-19T19:00:00.000Z",
});

assert.equal(closed.runtime_readiness_version, XAGENT_RUNTIME_READINESS_VERSION);
assert.equal(closed.checked_at, "2026-06-19T19:00:00.000Z");
assert.equal(closed.xagent_session_identity_supported, true);
assert.equal(closed.memory_context_injection_code_present, true);
assert.equal(closed.tavus_conversational_context_supported, true);
assert.equal(closed.memory_context_env_gates_open, false);
assert.equal(closed.normal_customer_button_changed, false);
assert.equal(closed.tavus_create_conversation_called, false);
assert.equal(closed.tavus_conversation_created, false);
assert.equal(closed.tavus_room_joined, false);
assert.equal(closed.live_tavus_called, false);
assert.equal(closed.live_hermes_called, false);
assert.equal(closed.openai_called, false);
assert.equal(closed.ollama_generate_called, false);
assert.equal(closed.resend_called, false);
assert.equal(closed.production_database_mutated, false);
assert.equal(closed.production_memory_persistence_used, false);
assert.equal(closed.outbound_action_taken, false);

const open = buildXAgentRuntimeReadiness({
  env: {
    XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
    XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
    XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
  },
  now: "2026-06-19T19:00:00.000Z",
});
assert.equal(open.memory_context_env_gates_open, true);

const unsafeSerialized = JSON.stringify(open);
const forbiddenExactKeys = new Set([
  "conversation_url",
  "conversational_context",
  "candidate_tavus_prompt_context",
  "recalled_memory_summary",
  "memory_namespace",
  "visitor_memory_namespace",
  "summary_hash",
  "record_hash",
  "transcript",
  "messages",
  "content",
  "api_key",
]);
for (const key of Object.keys(open)) {
  assert.equal(forbiddenExactKeys.has(key), false, `runtime readiness included unsafe key ${key}`);
}

const forbiddenSubstrings = [
  "TAVUS_API_KEY",
  "Bearer ",
  "Internal continuity context",
  "The visitor inquired",
  "diagnostic_context_supported",
  "hxmr_",
  "hxmc_",
  "hxls_",
  "hxor_",
  "xagents/",
];
for (const forbidden of forbiddenSubstrings) {
  assert.equal(unsafeSerialized.includes(forbidden), false, `runtime readiness leaked ${forbidden}`);
}

const originalFetch = globalThis.fetch;
let fetchCalled = false;
globalThis.fetch = async () => {
  fetchCalled = true;
  throw new Error("runtime readiness test must not call fetch");
};
try {
  buildXAgentRuntimeReadiness({
    env: {
      XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
      XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
      XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
    },
  });
  assert.equal(fetchCalled, false);
} finally {
  globalThis.fetch = originalFetch;
}

const routeSource = await readFile("app/api/xagent/runtime-readiness/route.ts", "utf8");
assert.match(routeSource, /buildXAgentRuntimeReadiness/);
assert.equal(routeSource.includes("createConversation"), false);
assert.equal(routeSource.includes("fetch("), false);

console.log("Hermes runtime readiness checks passed");
