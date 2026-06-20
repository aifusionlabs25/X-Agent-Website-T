import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildEmailMemoryStoreStatus } from "../lib/xagent/emailMemoryStoreStatus.mjs";
import {
  storeConversationEmailMappingForStart,
  storeEmailMemoryFromConversationTranscript,
} from "../lib/xagent/emailMemoryStore.mjs";

const envOpen = {
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_IDENTITY_SALT: "unit-test-production-shaped-salt",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

function createMockRedisFetch() {
  const store = new Map();
  const fetchImpl = async (_url, init = {}) => {
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
  return { fetchImpl };
}

function assertSafeStatus(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "rob@example.com",
    "unit-test-production-shaped-salt",
    "unit-test-token",
    "world cup soccer",
    "soccer products",
    "email_identity_hash",
    "visitor_memory_namespace",
    "recalled_memory_summary",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const { fetchImpl } = createMockRedisFetch();

const invalid = await buildEmailMemoryStoreStatus(
  { email: "not an email" },
  { env: envOpen, fetchImpl },
);
assert.equal(invalid.email_valid, false);
assert.equal(invalid.memory_store_checked, false);
assertSafeStatus(invalid);

const empty = await buildEmailMemoryStoreStatus(
  { email: "rob@example.com" },
  { env: envOpen, fetchImpl },
);
assert.equal(empty.email_valid, true);
assert.equal(empty.memory_store_checked, true);
assert.equal(empty.memory_context_available, false);
assertSafeStatus(empty);

await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "rob@example.com" },
    session_id: "xagent_session_status_test_001",
    provider_conversation_id: "conv_status_test_001",
    started_at: 1760000000000,
  },
  { env: envOpen, fetchImpl },
);

await storeEmailMemoryFromConversationTranscript(
  {
    provider_conversation_id: "conv_status_test_001",
    transcript: [
      { role: "user", content: "I run World Cup Soccer and sell soccer products." },
      { role: "user", content: "I want Dani to answer product questions from our API." },
      { role: "agent", content: "That sounds like a sales support X Agent." },
    ],
  },
  { env: envOpen, fetchImpl },
);

const found = await buildEmailMemoryStoreStatus(
  { email: "rob@example.com" },
  { env: envOpen, fetchImpl },
);
assert.equal(found.email_valid, true);
assert.equal(found.memory_store_checked, true);
assert.equal(found.memory_context_available, true);
assert.equal(found.lookup_source, "upstash_email_identity_memory_store");
assertSafeStatus(found);

const routeSource = await readFile("app/api/xagent/email-memory-store/status/route.ts", "utf8");
assert.match(routeSource, /buildEmailMemoryStoreStatus/);
assert.equal(routeSource.includes("recalled_memory_summary"), false);

console.log("Hermes email memory store status T42 checks passed");
