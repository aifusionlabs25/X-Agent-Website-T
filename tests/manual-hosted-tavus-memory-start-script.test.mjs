import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertHostedMemoryStartGates,
  runManualHostedTavusMemoryStart,
} from "../scripts/manual-hosted-tavus-memory-start.mjs";

const hostedUrl = "https://x-agent-website-t.example.test/api/conversation/start";
const baseEnv = {
  XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST: "true",
  XAGENT_HOSTED_TAVUS_MEMORY_START_URL: hostedUrl,
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
    "https://tavus.example/room-secret-not-printed",
    "The visitor inquired",
    "Internal continuity context",
    "conversational_context_secret",
    "candidate_tavus_prompt_context_secret",
    "TAVUS_API_KEY",
    "hxmr_",
    "hxmc_",
    "hxls_",
    "hxor_",
    "xagents/",
    "ca4ec4813b2a8413",
    "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
    "raw transcript should not print",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(serialized.includes(forbidden), false, `hosted safe output leaked ${forbidden}`);
  }
}

let fetchCalled = false;
await assert.rejects(
  () => runManualHostedTavusMemoryStart({
    env: { ...baseEnv, XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST: "" },
    fetchImpl: async () => {
      fetchCalled = true;
      return createJsonResponse(500, {});
    },
  }),
  /XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST=true is required/,
);
assert.equal(fetchCalled, false);

assert.throws(
  () => assertHostedMemoryStartGates({ XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST: "true" }),
  /XAGENT_HOSTED_TAVUS_MEMORY_START_URL is required/,
);
assert.throws(
  () => assertHostedMemoryStartGates({
    ...baseEnv,
    XAGENT_HOSTED_TAVUS_MEMORY_START_URL: "http://example.test/api/conversation/start",
  }),
  /must be an https URL/,
);
assert.throws(
  () => assertHostedMemoryStartGates({
    ...baseEnv,
    XAGENT_HOSTED_TAVUS_MEMORY_START_URL: "https://example.test/api/other",
  }),
  /must point to \/api\/conversation\/start/,
);

const unsafeMockRoutePayload = {
  conversation_url: "https://tavus.example/room-secret-not-printed",
  conversation_id: "hosted_tavus_conversation_capture_test_001",
  provider_conversation_id: "hosted_tavus_conversation_capture_test_001",
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_hosted_capture_test_001",
  session_id: "xagent_session_hosted_capture_test_001",
  provider: "tavus",
  memory_context_requested: true,
  memory_context_applied: true,
  tavus_conversational_context_attached: true,
  recalled_memory_summary: "The visitor inquired about a summary that must not print.",
  candidate_tavus_prompt_context: "candidate_tavus_prompt_context_secret",
  conversational_context: "conversational_context_secret",
  memory_namespace: "xagents/ai-fusion-labs/dani/visitor_hosted_capture_test_001/session",
  summary_hash: "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
  transcript: [{ role: "user", content: "raw transcript should not print" }],
};

let fetchCount = 0;
let capturedRequest;
const tempDir = await mkdtemp(join(tmpdir(), "hosted-tavus-memory-start-"));
try {
  const outputPath = join(tempDir, "hosted-safe-summary.json");
  const summary = await runManualHostedTavusMemoryStart({
    env: {
      ...baseEnv,
      XAGENT_HOSTED_TAVUS_MEMORY_START_OUTPUT_PATH: outputPath,
    },
    fetchImpl: async (url, request) => {
      fetchCount += 1;
      capturedRequest = { url, request };
      return createJsonResponse(200, unsafeMockRoutePayload);
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(capturedRequest.url, hostedUrl);
  assert.equal(capturedRequest.request.method, "POST");
  assert.equal(capturedRequest.request.headers["Content-Type"], "application/json");
  const requestBody = JSON.parse(capturedRequest.request.body);
  assert.equal(typeof requestBody.memory_context, "object");
  assert.equal(requestBody.memory_context.agent_slug, "dani");
  assert.equal(summary.http_status, 200);
  assert.equal(summary.conversation_url_present, true);
  assert.equal(summary.provider_conversation_id, "hosted_tavus_conversation_capture_test_001");
  assert.equal(summary.memory_context_requested, true);
  assert.equal(summary.memory_context_applied, true);
  assert.equal(summary.tavus_conversational_context_attached, true);
  assertSafeSerializedOutput(summary);

  const stored = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(stored, summary);
  assertSafeSerializedOutput(stored);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

const heroSource = await readFile("components/home/HeroBillboard.tsx", "utf8");
const agentDemoSource = await readFile("components/AgentDemoButton.tsx", "utf8");
assert.match(heroSource, /<TavusPlayer onClose=\{\(\) => setIsPlaying\(false\)\} \/>/);
assert.match(agentDemoSource, /<TavusPlayer onClose=\{\(\) => setIsPlaying\(false\)\} \/>/);

console.log("Manual hosted Tavus memory start script and audit checks passed");
