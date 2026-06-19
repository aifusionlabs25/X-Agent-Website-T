import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertManualLiveMemoryStartGates,
  runManualTavusLiveMemoryStart,
  sanitizeConversationStartResponse,
} from "../scripts/manual-tavus-live-memory-start.mjs";

const baseEnv = {
  XAGENT_ALLOW_LIVE_TAVUS_MEMORY_START_TEST: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
  TAVUS_API_KEY: "test_tavus_key_must_not_print",
  TAVUS_PERSONA_ID: "test_persona",
  TAVUS_REPLICA_ID: "test_replica",
};

function createJsonResponse(status, payload) {
  return {
    status,
    text: async () => JSON.stringify(payload),
  };
}

function assertSafeSerializedOutput(value) {
  const serialized = JSON.stringify(value);
  const forbiddenSubstrings = [
    "The visitor inquired",
    "Internal continuity context",
    "conversational_context_secret",
    "candidate_tavus_prompt_context_secret",
    "test_tavus_key_must_not_print",
    "TAVUS_API_KEY",
    "hxmr_",
    "hxmc_",
    "hxls_",
    "hxor_",
    "xagents/",
    "ca4ec4813b2a8413",
    "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
    "438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40",
    "raw transcript should not print",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `safe output leaked ${forbidden}`);
  }
}

let fetchCalled = false;
await assert.rejects(
  () => runManualTavusLiveMemoryStart([], {
    env: { ...baseEnv, XAGENT_ALLOW_LIVE_TAVUS_MEMORY_START_TEST: "" },
    fetchImpl: async () => {
      fetchCalled = true;
      return createJsonResponse(500, {});
    },
  }),
  /XAGENT_ALLOW_LIVE_TAVUS_MEMORY_START_TEST=true is required/,
);
assert.equal(fetchCalled, false);

await assert.rejects(
  () => runManualTavusLiveMemoryStart([], {
    env: { ...baseEnv, XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "false" },
    fetchImpl: async () => {
      fetchCalled = true;
      return createJsonResponse(500, {});
    },
  }),
  /XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED=true is required/,
);
assert.equal(fetchCalled, false);

assert.throws(
  () => assertManualLiveMemoryStartGates({ ...baseEnv, TAVUS_API_KEY: "" }),
  /TAVUS_API_KEY is required/,
);
assert.throws(
  () => assertManualLiveMemoryStartGates({ ...baseEnv, TAVUS_PERSONA_ID: "" }),
  /TAVUS_PERSONA_ID is required/,
);
assert.throws(
  () => assertManualLiveMemoryStartGates({ ...baseEnv, TAVUS_REPLICA_ID: "" }),
  /TAVUS_REPLICA_ID is required/,
);

const unsafeMockRoutePayload = {
  conversation_url: "https://tavus.example/room-secret-not-printed",
  conversation_id: "tavus_conversation_capture_test_001",
  provider_conversation_id: "tavus_conversation_capture_test_001",
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_capture_test_001",
  session_id: "xagent_session_capture_test_001",
  provider: "tavus",
  memory_context_requested: true,
  memory_context_applied: true,
  tavus_conversational_context_attached: true,
  recalled_memory_summary: "The visitor inquired about a summary that must not print.",
  candidate_tavus_prompt_context: "candidate_tavus_prompt_context_secret",
  conversational_context: "conversational_context_secret",
  memory_namespace: "xagents/ai-fusion-labs/dani/visitor_capture_test_001/session",
  summary_hash: "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
  transcript: [{ role: "user", content: "raw transcript should not print" }],
};

const sanitized = sanitizeConversationStartResponse(200, unsafeMockRoutePayload);
assert.deepEqual(sanitized, {
  http_status: 200,
  conversation_url_present: true,
  provider_conversation_id: "tavus_conversation_capture_test_001",
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_capture_test_001",
  session_id: "xagent_session_capture_test_001",
  provider: "tavus",
  memory_context_requested: true,
  memory_context_applied: true,
  tavus_conversational_context_attached: true,
});
assertSafeSerializedOutput(sanitized);

let fetchCount = 0;
let capturedRequest;
const tempDir = await mkdtemp(join(tmpdir(), "tavus-live-memory-start-"));
try {
  const outputPath = join(tempDir, "safe-summary.json");
  const summary = await runManualTavusLiveMemoryStart(["http://127.0.0.1:3999/api/conversation/start"], {
    env: {
      ...baseEnv,
      XAGENT_TAVUS_MEMORY_START_OUTPUT_PATH: outputPath,
    },
    fetchImpl: async (url, request) => {
      fetchCount += 1;
      capturedRequest = { url, request };
      return createJsonResponse(200, unsafeMockRoutePayload);
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(capturedRequest.url, "http://127.0.0.1:3999/api/conversation/start");
  assert.equal(capturedRequest.request.method, "POST");
  assert.equal(capturedRequest.request.headers["Content-Type"], "application/json");
  const requestBody = JSON.parse(capturedRequest.request.body);
  assert.equal(typeof requestBody.memory_context, "object");
  assert.equal(requestBody.memory_context.agent_slug, "dani");
  assert.equal(summary.provider_conversation_id, "tavus_conversation_capture_test_001");
  assertSafeSerializedOutput(summary);

  const stored = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(stored, summary);
  assertSafeSerializedOutput(stored);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("Manual Tavus live memory start script guard checks passed");
