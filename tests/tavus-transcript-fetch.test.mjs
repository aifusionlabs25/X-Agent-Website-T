import assert from "node:assert/strict";
import fixture from "./fixtures/tavus-verbose-conversation-transcription-ready.json" with { type: "json" };
import {
  extractTranscriptDetailsFromVerboseConversation,
  extractTranscriptFromVerboseConversation,
  getTranscriptForConversation,
} from "../lib/tavusTranscript.mjs";
import {
  buildDryRunResponse,
  buildSessionCompletedPayload,
} from "../lib/xagent/sessionCompletedPayload.mjs";

const calls = [];
const mockFetch = async (url, init) => {
  calls.push({ url, init });
  return {
    ok: true,
    status: 200,
    async json() {
      return fixture;
    },
  };
};

const transcript = await getTranscriptForConversation("tavus_conversation_test_001", {
  apiKey: "test_tavus_key",
  fetchImpl: mockFetch,
});

assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://tavusapi.com/v2/conversations/tavus_conversation_test_001?verbose=true");
assert.equal(calls[0].init.method, "GET");
assert.equal(calls[0].init.headers["x-api-key"], "test_tavus_key");
assert.equal(transcript.length, 2);
assert.equal(transcript[0].role, "user");
assert.equal(transcript[1].role, "agent");
assert.equal(transcript.every((turn) => turn.role === "user" || turn.role === "agent"), true);

const directParsedTranscript = extractTranscriptFromVerboseConversation(fixture);
assert.deepEqual(directParsedTranscript, transcript);

const details = extractTranscriptDetailsFromVerboseConversation(fixture);
assert.deepEqual(details.transcript, transcript);
assert.equal(details.metadata.source_turn_count, 4);
assert.equal(details.metadata.retained_memory_turn_count, 2);
assert.equal(details.metadata.dropped_non_memory_turn_count, 2);
assert.deepEqual(details.metadata.dropped_non_memory_roles, ["system", "tool"]);

assert.throws(
  () => extractTranscriptFromVerboseConversation({ ...fixture, events: [] }),
  /application\.transcription_ready event was not found/,
);

assert.throws(
  () => extractTranscriptFromVerboseConversation({
    ...fixture,
    events: [
      {
        event_type: "application.transcription_ready",
        properties: { transcript: [{ role: "assistant" }] },
      },
    ],
  }),
  /properties\.transcript\[0\]\.content is required/,
);

assert.throws(
  () => extractTranscriptFromVerboseConversation({
    ...fixture,
    events: [
      {
        event_type: "application.transcription_ready",
        properties: { transcript: [{ role: "system", content: "internal event" }] },
      },
    ],
  }),
  /no memory-safe user\/agent transcript turns remain/,
);

assert.throws(
  () => extractTranscriptFromVerboseConversation({
    ...fixture,
    events: [
      {
        event_type: "application.transcription_ready",
        properties: [{ role: "moderator", content: "unknown role" }],
      },
    ],
  }),
  /properties\.transcript must include at least one turn/,
);

assert.throws(
  () => extractTranscriptFromVerboseConversation({
    ...fixture,
    events: [
      {
        event_type: "application.transcription_ready",
        properties: { transcript: [{ role: "moderator", content: "unknown role" }] },
      },
    ],
  }),
  /role must be user or assistant/,
);

const completedInput = {
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_test_001",
  session_id: "xagent_session_test_001",
  provider: "tavus",
  provider_conversation_id: "tavus_conversation_test_001",
  completed_at: "2026-06-18T21:03:00Z",
  transcript,
};

const dryRun = buildDryRunResponse(completedInput);
const payload = dryRun.hermes_backend_payload;
const repeatPayload = buildSessionCompletedPayload(completedInput);

assert.deepEqual(payload.allowed_operations, ["summarize_session_for_memory"]);
assert.equal(payload.provider_role, "provenance_only");
assert.equal(payload.provider_conversation_id_used_for_namespace, false);
assert.equal(payload.memory_namespace, "xagents/ai-fusion-labs/dani/visitor_test_001/xagent_session_test_001");
assert.equal(payload.memory_namespace.includes("tavus_conversation_test_001"), false);
assert.equal(payload.idempotency_key, repeatPayload.idempotency_key);
assert.equal(payload.transcript_hash, repeatPayload.transcript_hash);
assert.equal(payload.transcript[0].content.includes("visitor@example.com"), false);
assert.equal(payload.transcript[0].content.includes("[REDACTED_SENSITIVE]"), true);
assert.equal(dryRun.live_hermes_called, false);
assert.equal(dryRun.webhook_registered, false);
assert.equal(dryRun.resend_called, false);

console.log("Tavus transcript fetch dry-run checks passed");
