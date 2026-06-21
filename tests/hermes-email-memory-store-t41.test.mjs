import assert from "node:assert/strict";
import {
  buildEmailMemoryRecordFromTranscript,
  readStoredEmailMemoryContext,
  storeConversationEmailMappingForStart,
  storeEmailMemoryFromConversationTranscript,
  summarizeTranscriptForMemory,
} from "../lib/xagent/emailMemoryStore.mjs";
import { maybeResolveServerSideMemoryContextForStart } from "../lib/xagent/serverSideMemoryContextResolver.mjs";

const envOpen = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED: "false",
  XAGENT_DANI_EMAIL_MEMORY_LOOKUP_PILOT_ENABLED: "false",
  XAGENT_EMAIL_MEMORY_LOOKUP_KILL_SWITCH: "true",
  XAGENT_EMAIL_IDENTITY_SALT: "unit-test-production-shaped-salt",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

function createMockRedisFetch() {
  const store = new Map();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    assert.equal(url, "https://unit-test-upstash.invalid/pipeline");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer unit-test-token");
    const commands = JSON.parse(init.body);
    const results = commands.map(([command, key, value]) => {
      if (command === "SET") {
        store.set(key, value);
        return { result: "OK" };
      }
      if (command === "GET") {
        return { result: store.get(key) ?? null };
      }
      return { error: `Unsupported command ${command}` };
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return results;
      },
    };
  };
  return { fetchImpl, store, calls };
}

function assertNoRawSensitiveValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "rob@example.com",
    "rvics@gmail.com",
    "r-v-i-c-k-s",
    "gmail dot com",
    "unit-test-production-shaped-salt",
    "unit-test-token",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

const transcript = [
  {
    role: "user",
    content: "Hey Dani, my name is Rob. I run World Cup Soccer and sell soccer products online.",
  },
  {
    role: "agent",
    content: "Great, are you thinking sales, support, or operations?",
  },
  {
    role: "user",
    content: "Sales. I want an X Agent as a bottom-right icon across product pages.",
  },
  {
    role: "user",
    content: "It should answer soccer ball questions from our product database and API.",
  },
  {
    role: "user",
    content: "Eventually it should check inventory, add items to cart, and guide shoppers to checkout.",
  },
  {
    role: "user",
    content: "My email is r-v-i-c-k-s at gmail dot com, please send a recap.",
  },
  {
    role: "user",
    content: "Let's shoot for Tuesday at 10 a.m. or 2 p.m. and send the invite to rvics@gmail.com.",
  },
  {
    role: "agent",
    content: "Our team will send a confirmation email and can use Tuesday at 2 p.m. as the requested technical call time.",
  },
];

const summary = summarizeTranscriptForMemory(transcript);
assert.match(summary.summary, /soccer products/i);
assert.match(summary.summary, /product database/i);
assert.match(summary.summary, /bottom-right icon/i);
assert.match(summary.summary, /Tuesday at 10 a\.m\. or 2 p\.m\./i);
assert.match(summary.summary, /Tuesday at 2 p\.m\./i);
assertNoRawSensitiveValue(summary);

const { fetchImpl, store } = createMockRedisFetch();
const mappingResult = await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "rob@example.com", display_name: "Rob" },
    session_id: "xagent_session_store_test_001",
    provider_conversation_id: "conv_store_test_001",
    started_at: 1760000000000,
  },
  { env: envOpen, fetchImpl },
);
assert.equal(mappingResult.email_memory_mapping_written, true);
assertNoRawSensitiveValue([...store.values()]);

const record = buildEmailMemoryRecordFromTranscript({
  mapping: JSON.parse([...store.values()][0]),
  transcript,
  transcriptMetadata: {
    source_turn_count: 6,
    retained_memory_turn_count: 6,
    dropped_non_memory_turn_count: 0,
    dropped_non_memory_roles: [],
  },
});
assert.equal(record.raw_email_stored, false);
assert.equal(record.normalized_email_stored, false);
assert.equal(record.raw_transcript_stored, false);
assert.equal(record.production_memory_database_mutated, true);
assert.match(record.recalled_memory_summary, /soccer products/i);
assert.match(record.recalled_memory_summary, /Tuesday at 10 a\.m\. or 2 p\.m\./i);
assert.match(record.recalled_memory_summary, /Tuesday at 2 p\.m\./i);
assertNoRawSensitiveValue(record);

const storeResult = await storeEmailMemoryFromConversationTranscript(
  {
    provider_conversation_id: "conv_store_test_001",
    transcript,
    transcriptMetadata: {
      source_turn_count: 6,
      retained_memory_turn_count: 6,
      dropped_non_memory_turn_count: 0,
      dropped_non_memory_roles: [],
    },
  },
  { env: envOpen, fetchImpl },
);
assert.equal(storeResult.memory_record_stored, true);
assert.equal(storeResult.memory_store_status, "stored");
assertNoRawSensitiveValue([...store.values()]);

const storedContext = await readStoredEmailMemoryContext(
  {
    email: "rob@example.com",
    nextSessionId: "xagent_session_store_test_002",
  },
  { env: envOpen, fetchImpl },
);
assert.equal(storedContext.lookup_source, "upstash_email_identity_memory_store");
assert.match(storedContext.memory_context.recalled_memory_summary, /soccer products/i);
assert.equal(storedContext.memory_context.next_session_id, "xagent_session_store_test_002");
assertNoRawSensitiveValue(storedContext);

const resolvedForStart = await maybeResolveServerSideMemoryContextForStart(
  { email: "rob@example.com" },
  {
    env: envOpen,
    fetchImpl,
    nextSessionId: "xagent_session_store_test_003",
  },
);
assert.equal(resolvedForStart.memory_context_requested, true);
assert.equal(resolvedForStart.memory_context_applied, true);
assert.equal(resolvedForStart.tavus_conversational_context_attached, true);
assert.equal(resolvedForStart.server_side_memory_context_source, "email_identity_memory_store");
assertNoRawSensitiveValue(resolvedForStart);

console.log("Hermes email memory store T41 checks passed");
