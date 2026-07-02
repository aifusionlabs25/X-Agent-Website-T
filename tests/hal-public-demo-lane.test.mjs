import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  readStoredEmailMemoryContext,
  storeConversationEmailMappingForStart,
  storeEmailMemoryFromConversationTranscript,
} from "../lib/xagent/emailMemoryStore.mjs";

const envOpen = {
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
  XAGENT_EMAIL_MEMORY_STORE_ENABLED: "true",
  XAGENT_DANI_EMAIL_MEMORY_STORE_PILOT_ENABLED: "true",
  XAGENT_EMAIL_MEMORY_STORE_KILL_SWITCH: "false",
  XAGENT_EMAIL_IDENTITY_SALT: "hal-unit-test-production-shaped-salt",
  UPSTASH_REDIS_REST_URL: "https://hal-unit-test-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "hal-unit-test-token",
};

function createMockRedisFetch() {
  const store = new Map();
  const fetchImpl = async (url, init = {}) => {
    assert.equal(url, "https://hal-unit-test-upstash.invalid/pipeline");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer hal-unit-test-token");

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
  return { fetchImpl, store };
}

function assertNoRawEmail(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  assert.equal(serialized.includes("rob@example.com"), false);
}

const { fetchImpl, store } = createMockRedisFetch();

const mappingResult = await storeConversationEmailMappingForStart(
  {
    requestBody: { email: "rob@example.com", display_name: "Rob" },
    session_id: "xagent_session_hal_public_001",
    provider_conversation_id: "conv_hal_public_001",
    started_at: 1760000000000,
  },
  { env: envOpen, fetchImpl, agentSlug: "hal" },
);

assert.equal(mappingResult.email_memory_mapping_written, true);
assertNoRawEmail([...store.values()]);

const keysAfterMapping = [...store.keys()];
assert.equal(keysAfterMapping.some((key) => key.includes(":hal:conversation:conv_hal_public_001")), true);
assert.equal(keysAfterMapping.some((key) => key.includes(":dani:conversation:conv_hal_public_001")), false);

const storeResult = await storeEmailMemoryFromConversationTranscript(
  {
    provider_conversation_id: "conv_hal_public_001",
    transcript: [
      {
        role: "user",
        content: "Hal should help prepare an executive podcast briefing and remember that I care about autopilot boundaries.",
      },
      {
        role: "agent",
        content: "I can reason from approved knowledge and hand back decisions that need Brian or a human operator.",
      },
    ],
  },
  { env: envOpen, fetchImpl, agentSlug: "hal" },
);

assert.equal(storeResult.memory_record_stored, true);
assertNoRawEmail([...store.values()]);

const halMemory = await readStoredEmailMemoryContext(
  {
    email: "rob@example.com",
    nextSessionId: "xagent_session_hal_public_002",
  },
  { env: envOpen, fetchImpl, agentSlug: "hal" },
);

assert.equal(halMemory.memory_context.agent_slug, "hal");
assert.match(halMemory.memory_context.recalled_memory_summary, /executive podcast briefing|autopilot/i);
assertNoRawEmail(halMemory);

const daniMemory = await readStoredEmailMemoryContext(
  {
    email: "rob@example.com",
    nextSessionId: "xagent_session_dani_public_002",
  },
  { env: envOpen, fetchImpl },
);

assert.equal(daniMemory, null);

const halRouteSource = await readFile("app/api/hal/conversation/start/route.ts", "utf8");
assert.match(halRouteSource, /tavusConfigForAgent\(HAL_AGENT_SLUG\)/);
assert.match(halRouteSource, /createConversationWithConfig/);
assert.match(halRouteSource, /buildTavusCallbackUrl/);
assert.match(halRouteSource, /agentSlug: HAL_AGENT_SLUG/);
assert.match(halRouteSource, /storeConversationEmailMappingForStart/);
assert.match(halRouteSource, /HAL_TAVUS_PERSONA_ID/);
assert.match(halRouteSource, /HAL_TAVUS_REPLICA_ID/);

const webhookSource = await readFile("app/api/webhook/route.ts", "utf8");
assert.match(webhookSource, /searchParams\.get\("agent"\) === "hal"/);

const webhookHandlerSource = await readFile("lib/xagent/tavusTranscriptionMemoryWebhook.mjs", "utf8");
assert.doesNotMatch(webhookHandlerSource, /hal_memory_only_webhook/);
assert.doesNotMatch(webhookHandlerSource, /skipped_for_hal_public_demo/);
assert.match(webhookHandlerSource, /runHermesEmailCommunicationsOperator/);
assert.match(webhookHandlerSource, /runAgentMailPostSessionSends/);
assert.match(webhookHandlerSource, /storeHermesEmailActionStatus/);

const configSource = await readFile("lib/config.ts", "utf8");
assert.match(configSource, /isHal \? env\("HAL_TAVUS_PERSONA_ID"\) : env\("TAVUS_PERSONA_ID"\)/);
assert.match(configSource, /isHal \? env\("HAL_TAVUS_REPLICA_ID"\) : env\("TAVUS_REPLICA_ID"\)/);
assert.doesNotMatch(configSource, /HAL_TAVUS_PERSONA_ID"\) \|\| env\("TAVUS_PERSONA_ID"/);
assert.doesNotMatch(configSource, /HAL_TAVUS_REPLICA_ID"\) \|\| env\("TAVUS_REPLICA_ID"/);

const halPageSource = await readFile("app/hal/page.tsx", "utf8");
assert.match(halPageSource, /\/agents\/hal\/hal-newest-2026-06-30\.png/);
assert.doesNotMatch(halPageSource, /hal-concept-v1\.png/);

const agentsSource = await readFile("lib/agents.ts", "utf8");
assert.match(agentsSource, /\/agents\/hal\/hal-newest-2026-06-30\.png/);

const halSystemPrompt = await readFile("docs/HAL_TAVUS_SYSTEM_PROMPT_2026-07-01.md", "utf8");
assert.match(halSystemPrompt, /MANDATORY FIRST GREETING/);
assert.match(halSystemPrompt, /You are not Brian Halligan/);
assert.match(halSystemPrompt, /must never claim Brian[’']s private memory/);
assert.match(halSystemPrompt, /HARD SPOKEN OUTPUT RULE/);
assert.match(halSystemPrompt, /The default deployment profile is PUBLIC_DEMO/);
assert.match(halSystemPrompt, /A successful action claim requires/);
assert.match(halSystemPrompt, /MEETING DELEGATE RULE/);
assert.match(halSystemPrompt, /ANTI-CREEPY NATURALNESS RULE/);
assert.match(halSystemPrompt, /Hal has approved post-session email support through the surrounding team and workflow/);
assert.match(halSystemPrompt, /I can have the team send session-related follow-up/);
assert.doesNotMatch(halSystemPrompt, /â/);

console.log("Hal public demo lane checks passed");
