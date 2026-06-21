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
assert.equal(closed.hermes_memory_operator_code_present, true);
assert.equal(closed.hermes_memory_operator_env_gates_open, false);
assert.equal(closed.hermes_memory_operator_mode, "embedded");
assert.equal(closed.hermes_memory_operator_gateway_live_calls_enabled, false);
assert.equal(closed.hermes_email_actions_code_present, true);
assert.equal(closed.hermes_email_actions_env_gates_open, false);
assert.equal(closed.hermes_email_actions_mode, "draft_only");
assert.equal(closed.hermes_email_actions_provider, "none");
assert.equal(closed.hermes_email_actions_send_mode_requested, false);
assert.equal(closed.hermes_email_actions_live_send_enabled, false);
assert.equal(closed.agentmail_adapter_code_present, true);
assert.equal(closed.agentmail_adapter_env_gates_open, false);
assert.equal(closed.agentmail_inbox_address_configured, false);
assert.equal(closed.agentmail_inbox_matches_dani, false);
assert.equal(closed.agentmail_api_key_present, false);
assert.equal(closed.agentmail_live_calls_enabled, false);
assert.equal(closed.agentmail_send_adapter_code_present, true);
assert.equal(closed.agentmail_send_adapter_env_gates_open, false);
assert.equal(closed.agentmail_send_adapter_mode, "preview");
assert.equal(closed.agentmail_send_adapter_live_mode_requested, false);
assert.equal(closed.agentmail_send_adapter_ready_for_t49_one_send_test, false);
assert.equal(closed.agentmail_action_ledger_code_present, true);
assert.equal(closed.agentmail_action_ledger_persistence_enabled, false);
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
    XAGENT_HERMES_MEMORY_OPERATOR_ENABLED: "true",
    XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED: "true",
    XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH: "false",
    XAGENT_HERMES_MEMORY_OPERATOR_MODE: "embedded",
    XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
    XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
    XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
    XAGENT_HERMES_EMAIL_ACTIONS_MODE: "draft_only",
    XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "agentmail",
    XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true",
    XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true",
    XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false",
    XAGENT_DANI_AGENTMAIL_ADDRESS: "danixagent@agentmail.to",
    AGENTMAIL_API_KEY: "am_us_inbox_runtime_test_secret",
    XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED: "true",
    XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED: "true",
    XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH: "false",
    XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "preview",
  },
  now: "2026-06-19T19:00:00.000Z",
});
assert.equal(open.memory_context_env_gates_open, true);
assert.equal(open.hermes_memory_operator_env_gates_open, true);
assert.equal(open.hermes_memory_operator_mode, "embedded");
assert.equal(open.hermes_memory_operator_gateway_live_calls_enabled, false);
assert.equal(open.hermes_email_actions_env_gates_open, true);
assert.equal(open.hermes_email_actions_mode, "draft_only");
assert.equal(open.hermes_email_actions_provider, "agentmail");
assert.equal(open.hermes_email_actions_send_mode_requested, false);
assert.equal(open.hermes_email_actions_live_send_enabled, false);
assert.equal(open.agentmail_adapter_env_gates_open, true);
assert.equal(open.agentmail_inbox_address_configured, true);
assert.equal(open.agentmail_inbox_matches_dani, true);
assert.equal(open.agentmail_api_key_present, true);
assert.equal(open.agentmail_live_calls_enabled, false);
assert.equal(open.agentmail_send_adapter_env_gates_open, true);
assert.equal(open.agentmail_send_adapter_mode, "preview");
assert.equal(open.agentmail_send_adapter_live_mode_requested, false);
assert.equal(open.agentmail_send_adapter_ready_for_t49_one_send_test, false);
assert.equal(open.agentmail_action_ledger_code_present, true);
assert.equal(open.agentmail_action_ledger_persistence_enabled, false);

const gatewayOpen = buildXAgentRuntimeReadiness({
  env: {
    XAGENT_HERMES_MEMORY_OPERATOR_ENABLED: "true",
    XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED: "true",
    XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH: "false",
    XAGENT_HERMES_MEMORY_OPERATOR_MODE: "gateway",
  },
  now: "2026-06-19T19:00:00.000Z",
});
assert.equal(gatewayOpen.hermes_memory_operator_env_gates_open, true);
assert.equal(gatewayOpen.hermes_memory_operator_mode, "gateway");
assert.equal(gatewayOpen.hermes_memory_operator_gateway_live_calls_enabled, true);

const emailSendOpen = buildXAgentRuntimeReadiness({
  env: {
    XAGENT_HERMES_EMAIL_ACTIONS_ENABLED: "true",
    XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED: "true",
    XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH: "false",
    XAGENT_HERMES_EMAIL_ACTIONS_MODE: "send",
    XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER: "resend",
  },
  now: "2026-06-19T19:00:00.000Z",
});
assert.equal(emailSendOpen.hermes_email_actions_env_gates_open, true);
assert.equal(emailSendOpen.hermes_email_actions_mode, "send");
assert.equal(emailSendOpen.hermes_email_actions_provider, "resend");
assert.equal(emailSendOpen.hermes_email_actions_send_mode_requested, true);
assert.equal(emailSendOpen.hermes_email_actions_live_send_enabled, false);

const agentMailLiveRequested = buildXAgentRuntimeReadiness({
  env: {
    XAGENT_HERMES_AGENTMAIL_ADAPTER_ENABLED: "true",
    XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED: "true",
    XAGENT_HERMES_AGENTMAIL_ADAPTER_KILL_SWITCH: "false",
    XAGENT_DANI_AGENTMAIL_ADDRESS: "danixagent@agentmail.to",
    AGENTMAIL_API_KEY: "am_us_inbox_runtime_test_secret",
    XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_ENABLED: "true",
    XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED: "true",
    XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_KILL_SWITCH: "false",
    XAGENT_HERMES_AGENTMAIL_SEND_ADAPTER_MODE: "live",
  },
  now: "2026-06-19T19:00:00.000Z",
});
assert.equal(agentMailLiveRequested.agentmail_send_adapter_env_gates_open, true);
assert.equal(agentMailLiveRequested.agentmail_send_adapter_mode, "live");
assert.equal(agentMailLiveRequested.agentmail_send_adapter_live_mode_requested, true);
assert.equal(agentMailLiveRequested.agentmail_send_adapter_ready_for_t49_one_send_test, true);
assert.equal(agentMailLiveRequested.agentmail_live_calls_enabled, false);

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
  "XAGENT_HERMES_GATEWAY_TOKEN",
  "XAGENT_HERMES_GATEWAY_URL",
  "AGENTMAIL_API_KEY",
  "am_us_inbox_runtime_test_secret",
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
      XAGENT_HERMES_MEMORY_OPERATOR_ENABLED: "true",
      XAGENT_DANI_HERMES_MEMORY_OPERATOR_PILOT_ENABLED: "true",
      XAGENT_HERMES_MEMORY_OPERATOR_KILL_SWITCH: "false",
      XAGENT_HERMES_MEMORY_OPERATOR_MODE: "embedded",
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
