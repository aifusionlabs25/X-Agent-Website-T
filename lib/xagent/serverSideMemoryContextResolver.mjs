import defaultMemoryContextFixture from "../../tests/fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  areConversationStartMemoryContextGatesOpen,
  buildConversationStartMemoryContextForRequestBody,
  hasSuppliedConversationStartMemoryContext,
} from "./conversationStartMemoryContext.mjs";

const ENABLED_ENV = "XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

export function areServerSideMemoryContextResolverGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    areConversationStartMemoryContextGatesOpen(overrides)
    && gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function loadServerSideMemoryContextFixture(options = {}) {
  return JSON.parse(JSON.stringify(options.memoryContext ?? defaultMemoryContextFixture));
}

export async function maybeResolveServerSideMemoryContextForStart(body, options = {}) {
  const envSource = options.env ?? process.env;

  if (hasSuppliedConversationStartMemoryContext(body)) {
    return undefined;
  }
  if (!areServerSideMemoryContextResolverGatesOpen(envSource)) {
    return undefined;
  }

  const memoryContext = loadServerSideMemoryContextFixture(options);
  return {
    ...buildConversationStartMemoryContextForRequestBody(
      { memory_context: memoryContext },
      { env: envSource },
    ),
    server_side_memory_context_resolved: true,
    server_side_memory_context_source: "local_fixture",
  };
}
