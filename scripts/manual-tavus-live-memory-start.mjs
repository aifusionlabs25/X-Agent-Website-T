import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOW_ENV = "XAGENT_ALLOW_LIVE_TAVUS_MEMORY_START_TEST";
const REQUIRED_FLAGS = {
  [ALLOW_ENV]: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_ENABLED: "true",
  XAGENT_DANI_TAVUS_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_CONTEXT_INJECTION_KILL_SWITCH: "false",
};
const REQUIRED_VALUES = [
  "TAVUS_API_KEY",
  "TAVUS_PERSONA_ID",
  "TAVUS_REPLICA_ID",
];
const DEFAULT_START_URL = "http://127.0.0.1:3000/api/conversation/start";
const DEFAULT_FIXTURE_PATH = "tests/fixtures/hermes-next-session-context-preview-dani.json";

function env(key, envSource = process.env) {
  return envSource[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function requireExactEnv(key, expected, envSource = process.env) {
  const actual = env(key, envSource);
  if (actual !== expected) {
    throw new Error(`${key}=${expected} is required`);
  }
}

function requireValueEnv(key, envSource = process.env) {
  if (!env(key, envSource)) {
    throw new Error(`${key} is required`);
  }
}

export function assertManualLiveMemoryStartGates(envSource = process.env) {
  for (const [key, expected] of Object.entries(REQUIRED_FLAGS)) {
    requireExactEnv(key, expected, envSource);
  }
  for (const key of REQUIRED_VALUES) {
    requireValueEnv(key, envSource);
  }
}

export function sanitizeConversationStartResponse(httpStatus, payload = {}) {
  return {
    http_status: Number(httpStatus),
    conversation_url_present: typeof payload.conversation_url === "string" && payload.conversation_url.length > 0,
    provider_conversation_id: typeof payload.provider_conversation_id === "string"
      ? payload.provider_conversation_id
      : typeof payload.conversation_id === "string"
        ? payload.conversation_id
        : null,
    tenant_id: typeof payload.tenant_id === "string" ? payload.tenant_id : null,
    agent_slug: typeof payload.agent_slug === "string" ? payload.agent_slug : null,
    visitor_id: typeof payload.visitor_id === "string" ? payload.visitor_id : null,
    session_id: typeof payload.session_id === "string" ? payload.session_id : null,
    provider: typeof payload.provider === "string" ? payload.provider : null,
    memory_context_requested: Boolean(payload.memory_context_requested),
    memory_context_applied: Boolean(payload.memory_context_applied),
    tavus_conversational_context_attached: Boolean(payload.tavus_conversational_context_attached),
  };
}

async function readMemoryFixture(fixturePath) {
  const fixture = await readFile(resolve(fixturePath), "utf8");
  return JSON.parse(fixture);
}

function resolveStartUrl(argv = [], envSource = process.env) {
  return argv[0] || env("XAGENT_TAVUS_MEMORY_START_URL", envSource) || DEFAULT_START_URL;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function maybeWriteSummary(summary, envSource = process.env) {
  const outputPath = env("XAGENT_TAVUS_MEMORY_START_OUTPUT_PATH", envSource);
  if (!outputPath) {
    return;
  }
  const resolved = resolve(outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

export async function runManualTavusLiveMemoryStart(argv = process.argv.slice(2), options = {}) {
  const envSource = options.env ?? process.env;
  assertManualLiveMemoryStartGates(envSource);

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is required");
  }

  const fixturePath = options.fixturePath || env("XAGENT_TAVUS_MEMORY_START_FIXTURE_PATH", envSource) || DEFAULT_FIXTURE_PATH;
  const memoryContext = await readMemoryFixture(fixturePath);
  const url = options.url ?? resolveStartUrl(argv, envSource);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory_context: memoryContext }),
  });
  const payload = await parseJsonResponse(response);
  const summary = sanitizeConversationStartResponse(response.status, payload);
  await maybeWriteSummary(summary, envSource);
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runManualTavusLiveMemoryStart()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
