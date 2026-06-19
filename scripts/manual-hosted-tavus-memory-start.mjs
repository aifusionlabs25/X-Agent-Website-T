import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeConversationStartResponse } from "./manual-tavus-live-memory-start.mjs";

const ALLOW_ENV = "XAGENT_ALLOW_LIVE_HOSTED_TAVUS_MEMORY_START_TEST";
const URL_ENV = "XAGENT_HOSTED_TAVUS_MEMORY_START_URL";
const OUTPUT_ENV = "XAGENT_HOSTED_TAVUS_MEMORY_START_OUTPUT_PATH";
const FIXTURE_ENV = "XAGENT_HOSTED_TAVUS_MEMORY_START_FIXTURE_PATH";
const DEFAULT_FIXTURE_PATH = "tests/fixtures/hermes-next-session-context-preview-dani.json";

function env(key, envSource = process.env) {
  return envSource[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function requireAllowGate(envSource = process.env) {
  if (env(ALLOW_ENV, envSource) !== "true") {
    throw new Error(`${ALLOW_ENV}=true is required`);
  }
}

function validateHostedStartUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${URL_ENV} must be an https URL`);
  }
  if (url.pathname !== "/api/conversation/start") {
    throw new Error(`${URL_ENV} must point to /api/conversation/start`);
  }
  return url.toString();
}

export function assertHostedMemoryStartGates(envSource = process.env) {
  requireAllowGate(envSource);
  const url = env(URL_ENV, envSource);
  if (!url) {
    throw new Error(`${URL_ENV} is required`);
  }
  return {
    url: validateHostedStartUrl(url),
  };
}

async function readMemoryFixture(fixturePath) {
  const fixture = await readFile(resolve(fixturePath), "utf8");
  return JSON.parse(fixture);
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function maybeWriteSummary(summary, envSource = process.env) {
  const outputPath = env(OUTPUT_ENV, envSource);
  if (!outputPath) return;
  const resolved = resolve(outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

export async function runManualHostedTavusMemoryStart(options = {}) {
  const envSource = options.env ?? process.env;
  const { url } = assertHostedMemoryStartGates(envSource);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is required");
  }

  const fixturePath = options.fixturePath || env(FIXTURE_ENV, envSource) || DEFAULT_FIXTURE_PATH;
  const memoryContext = await readMemoryFixture(fixturePath);
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
  runManualHostedTavusMemoryStart()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
