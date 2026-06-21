import assert from "node:assert/strict";
import { storeConversationEmailMappingForStart } from "../lib/xagent/emailMemoryStore.mjs";
import {
  areHermesMemoryOperatorGatesOpen,
  HERMES_EMAIL_MEMORY_OPERATOR_VERSION,
  readHermesMemoryOperatorMode,
  runHermesEmailMemoryOperator,
} from "../lib/xagent/hermesEmailMemoryOperator.mjs";

const baseEnv = {
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_IDENTITY_SALT: "unit-test-production-shaped-salt",
  UPSTASH_REDIS_REST_URL: "https://unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "unit-test-token",
};

const embeddedEnv = {
  ...baseEnv,
  XAGENT_HERMES_MEMORY_OPERATOR_ENABLED: "true",
  XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED: "true",
  XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH: "false",
  XAGENT_HERMES_MEMORY_OPERATOR_MODE: "embedded",
};

const gatewayEnv = {
  ...embeddedEnv,
  XAGENT_HERMES_MEMORY_OPERATOR_MODE: "gateway",
  XAGENT_HERMES_GATEWAY_URL: "https://unit-test-hermes.invalid/operator",
  XAGENT_HERMES_GATEWAY_TOKEN: "unit-test-hermes-token",
  XAGENT_HERMES_GATEWAY_TIMEOUT_MS: "2500",
};

const transcript = [
  {
    role: "user",
    content: "Hey Dani, I run World Cup Soccer and sell soccer products.",
  },
  {
    role: "agent",
    content: "Are you thinking sales, support, or operations?",
  },
  {
    role: "user",
    content: "Sales. I want a bottom-right icon across product pages.",
  },
  {
    role: "user",
    content: "It should answer soccer ball questions from our product database and API.",
  },
  {
    role: "user",
    content: "Eventually it should check inventory, add items to cart, and guide shoppers to checkout.",
  },
];

function createMockFetch({ gatewayResponse } = {}) {
  const store = new Map();
  const calls = [];
  const gatewayCalls = [];

  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });

    if (url === "https://unit-test-upstash.invalid/pipeline") {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer unit-test-token");
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
    }

    if (url === "https://unit-test-hermes.invalid/operator") {
      gatewayCalls.push({ url, init, body: JSON.parse(init.body) });
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer unit-test-hermes-token");
      return {
        ok: true,
        status: 200,
        async json() {
          return gatewayResponse ?? {
            summary: "Gateway summary: Rob runs World Cup Soccer, sells soccer products, wants product-page sales support, API-backed product answers, inventory checks, cart help, and checkout guidance.",
            confidence: 0.83,
            redacted_transcript_hash: "gateway-redacted-transcript-hash",
            operator_metadata: {
              gateway_fixture: true,
            },
          };
        },
      };
    }

    throw new Error(`unexpected fetch URL ${url}`);
  };

  return { fetchImpl, store, calls, gatewayCalls };
}

function recordsFromStore(store) {
  return [...store.values()].map((value) => JSON.parse(value));
}

function latestMemoryRecord(store) {
  return recordsFromStore(store).find((record) => record.memory_record_id);
}

function assertNoUnsafeValue(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "rob@example.com",
    "rvics@gmail.com",
    "unit-test-production-shaped-salt",
    "unit-test-token",
    "unit-test-hermes-token",
    "messages",
    "transcript_content",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

async function seedMapping({ env, fetchImpl, providerConversationId }) {
  const result = await storeConversationEmailMappingForStart(
    {
      requestBody: { email: "rob@example.com", display_name: "Rob" },
      session_id: `${providerConversationId}_session`,
      provider_conversation_id: providerConversationId,
      started_at: 1760000000000,
    },
    { env, fetchImpl },
  );
  assert.equal(result.email_memory_mapping_written, true);
}

assert.equal(areHermesMemoryOperatorGatesOpen(embeddedEnv), true);
assert.equal(readHermesMemoryOperatorMode(embeddedEnv), "embedded");
assert.equal(readHermesMemoryOperatorMode(gatewayEnv), "gateway");
assert.equal(areHermesMemoryOperatorGatesOpen({
  XAGENT_HERMES_MEMORY_OPERATOR_ENABLED: "true ",
  XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED: "true ",
  XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH: "false ",
}), true);
assert.equal(readHermesMemoryOperatorMode({
  XAGENT_HERMES_MEMORY_OPERATOR_MODE: "embedded ",
}), "embedded");
assert.equal(HERMES_EMAIL_MEMORY_OPERATOR_VERSION, "t45_hermes_email_memory_operator_v1");

{
  const { fetchImpl, store, gatewayCalls } = createMockFetch();
  await seedMapping({ env: embeddedEnv, fetchImpl, providerConversationId: "conv_operator_embedded_001" });

  const result = await runHermesEmailMemoryOperator(
    {
      provider_conversation_id: "conv_operator_embedded_001",
      transcript,
      transcriptMetadata: {
        source_turn_count: 5,
        retained_memory_turn_count: 5,
        dropped_non_memory_turn_count: 0,
        dropped_non_memory_roles: [],
      },
    },
    { env: embeddedEnv, fetchImpl },
  );

  assert.equal(result.hermes_operator_attempted, true);
  assert.equal(result.hermes_operator_invoked, true);
  assert.equal(result.hermes_operator_mode, "embedded");
  assert.equal(result.hermes_operator_status, "completed");
  assert.equal(result.hermes_gateway_called, false);
  assert.equal(result.live_hermes_called, false);
  assert.equal(result.memory_record_stored, true);
  assert.equal(gatewayCalls.length, 0);

  const record = latestMemoryRecord(store);
  assert.equal(record.hermes_operator_metadata.hermes_operator_version, HERMES_EMAIL_MEMORY_OPERATOR_VERSION);
  assert.equal(record.hermes_operator_metadata.hermes_operator_mode, "embedded");
  assert.equal(record.hermes_operator_metadata.hermes_operator_invoked, true);
  assert.equal(record.hermes_operator_metadata.hermes_gateway_called, false);
  assert.match(record.recalled_memory_summary, /World Cup Soccer/);
  assert.match(record.recalled_memory_summary, /product database/);
  assertNoUnsafeValue(result);
  assertNoUnsafeValue(record);
}

{
  const { fetchImpl, store, gatewayCalls } = createMockFetch();
  await seedMapping({ env: baseEnv, fetchImpl, providerConversationId: "conv_operator_fallback_001" });

  const result = await runHermesEmailMemoryOperator(
    {
      provider_conversation_id: "conv_operator_fallback_001",
      transcript,
      transcriptMetadata: {
        source_turn_count: 5,
        retained_memory_turn_count: 5,
        dropped_non_memory_turn_count: 0,
        dropped_non_memory_roles: [],
      },
    },
    { env: baseEnv, fetchImpl },
  );

  assert.equal(result.hermes_operator_attempted, true);
  assert.equal(result.hermes_operator_invoked, false);
  assert.equal(result.hermes_operator_mode, "embedded");
  assert.equal(result.hermes_operator_status, "embedded_fallback_because_gates_closed");
  assert.equal(result.hermes_gateway_called, false);
  assert.equal(result.live_hermes_called, false);
  assert.equal(result.memory_record_stored, true);
  assert.equal(gatewayCalls.length, 0);

  const record = latestMemoryRecord(store);
  assert.equal(record.hermes_operator_metadata.hermes_operator_gates_open, false);
  assert.equal(record.hermes_operator_metadata.hermes_operator_invoked, false);
  assert.equal(record.hermes_operator_metadata.local_embedded_operator_used, true);
  assertNoUnsafeValue(result);
  assertNoUnsafeValue(record);
}

{
  const { fetchImpl, store, gatewayCalls } = createMockFetch();
  await seedMapping({ env: gatewayEnv, fetchImpl, providerConversationId: "conv_operator_gateway_001" });

  const result = await runHermesEmailMemoryOperator(
    {
      provider_conversation_id: "conv_operator_gateway_001",
      transcript,
      transcriptMetadata: {
        source_turn_count: 5,
        retained_memory_turn_count: 5,
        dropped_non_memory_turn_count: 0,
        dropped_non_memory_roles: [],
      },
    },
    { env: gatewayEnv, fetchImpl },
  );

  assert.equal(result.hermes_operator_attempted, true);
  assert.equal(result.hermes_operator_invoked, true);
  assert.equal(result.hermes_operator_mode, "gateway");
  assert.equal(result.hermes_gateway_called, true);
  assert.equal(result.live_hermes_called, true);
  assert.equal(result.memory_record_stored, true);
  assert.equal(gatewayCalls.length, 1);
  assert.equal(gatewayCalls[0].body.requested_operation, "summarize_session_for_memory");
  assert.equal(gatewayCalls[0].body.policies.post_session_only, true);
  assert.equal(gatewayCalls[0].body.policies.live_turn_loop_dependency, false);
  assert.equal(gatewayCalls[0].body.policies.outbound_action_allowed, false);

  const record = latestMemoryRecord(store);
  assert.equal(record.hermes_operator_metadata.hermes_operator_mode, "gateway");
  assert.equal(record.hermes_operator_metadata.hermes_gateway_called, true);
  assert.match(record.recalled_memory_summary, /Gateway summary/);
  assertNoUnsafeValue(result);
  assertNoUnsafeValue(record);
}

{
  const { fetchImpl } = createMockFetch();
  const missing = await runHermesEmailMemoryOperator(
    {
      provider_conversation_id: "conv_operator_missing_mapping_001",
      transcript,
      transcriptMetadata: {},
    },
    { env: embeddedEnv, fetchImpl },
  );
  assert.equal(missing.memory_record_stored, false);
  assert.equal(missing.memory_store_status, "conversation_email_mapping_not_found");
  assert.equal(missing.hermes_operator_invoked, false);
  assertNoUnsafeValue(missing);
}

console.log("Hermes email memory operator T45 checks passed");
