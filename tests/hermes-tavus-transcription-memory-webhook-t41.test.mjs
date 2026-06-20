import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storeConversationEmailMappingForStart } from "../lib/xagent/emailMemoryStore.mjs";
import { handleTavusTranscriptionMemoryWebhook } from "../lib/xagent/tavusTranscriptionMemoryWebhook.mjs";

const envOpen = {
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_ENABLED: "true",
  XAGENT_DANI_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_PILOT_ENABLED: "true",
  XAGENT_TAVUS_TRANSCRIPTION_MEMORY_WEBHOOK_KILL_SWITCH: "false",
  XAGENT_EMAIL_IDENTITY_SALT: "unit-test-production-shaped-salt",
  XAGENT_TAVUS_CALLBACK_TOKEN: "unit-test-callback-token",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

function createMockRedisFetch() {
  const store = new Map();
  const fetchImpl = async (url, init = {}) => {
    assert.equal(url, "https://unit-test-upstash.invalid/pipeline");
    const commands = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return commands.map(([command, key, value]) => {
          if (command === "SET") {
            store.set(key, value);
            return { result: "OK" };
          }
          if (command === "GET") {
            return { result: store.get(key) ?? null };
          }
          return { error: `Unsupported command ${command}` };
        });
      },
    };
  };
  return { fetchImpl, store };
}

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "rob@example.com",
    "rvics@gmail.com",
    "unit-test-production-shaped-salt",
    "unit-test-token",
    "r-v-i-c-k-s",
    "gmail dot com",
    "messages",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const { fetchImpl, store } = createMockRedisFetch();
await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "rob@example.com" },
    session_id: "xagent_session_webhook_test_001",
    provider_conversation_id: "conv_webhook_test_001",
    started_at: 1760000000000,
  },
  { env: envOpen, fetchImpl },
);

const callbackPayload = {
  conversation_id: "conv_webhook_test_001",
  event_type: "application.transcription_ready",
  message_type: "application",
  timestamp: "2026-06-20T12:00:00.000Z",
  properties: {
    transcript: [
      { role: "system", content: "internal system turn" },
      { role: "user", content: "Hey Dani, I run World Cup Soccer and sell soccer products." },
      { role: "assistant", content: "Are you thinking sales or support?" },
      { role: "user", content: "Sales. I need a bottom-right icon on product pages." },
      { role: "user", content: "The agent should use our product database and API for soccer ball questions." },
      { role: "user", content: "My email is r-v-i-c-k-s at gmail dot com." },
    ],
  },
};

const result = await handleTavusTranscriptionMemoryWebhook(callbackPayload, {
  env: envOpen,
  fetchImpl,
  callbackToken: "unit-test-callback-token",
});

assert.equal(result.transcription_ready_processed, true);
assert.equal(result.memory_record_stored, true);
assert.equal(result.memory_store_status, "stored");
assert.equal(result.live_tavus_called, false);
assert.equal(result.live_hermes_called, false);
assert.equal(result.openai_called, false);
assert.equal(result.ollama_generate_called, false);
assert.equal(result.resend_called, false);
assert.equal(result.outbound_action_taken, false);
assert.equal(result.production_memory_database_mutated, true);
assertNoUnsafeValue(result);
assertNoUnsafeValue([...store.values()]);
assert.match(JSON.stringify([...store.values()]), /World Cup Soccer/);
assert.match(JSON.stringify([...store.values()]), /product database/);

await assert.rejects(
  () => handleTavusTranscriptionMemoryWebhook(callbackPayload, {
    env: envOpen,
    fetchImpl,
    callbackToken: "wrong-token",
  }),
  /invalid Tavus callback token/,
);

const ignored = await handleTavusTranscriptionMemoryWebhook(
  { conversation_id: "conv_webhook_test_001", event_type: "conversation.started" },
  { env: envOpen, fetchImpl, callbackToken: "unit-test-callback-token" },
);
assert.equal(ignored.memory_record_stored, false);
assert.equal(ignored.memory_store_status, "ignored_event_type");

const routeSource = await readFile("app/api/webhook/route.ts", "utf8");
assert.match(routeSource, /handleTavusTranscriptionMemoryWebhook/);
assert.equal(routeSource.includes("new Resend"), false);
assert.equal(routeSource.includes("resend.emails.send"), false);
assert.equal(routeSource.includes("new OpenAI"), false);

console.log("Hermes Tavus transcription memory webhook T41 checks passed");
