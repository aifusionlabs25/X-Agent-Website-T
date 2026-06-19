import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  buildGatedTavusMemoryPromptPreview,
  buildTavusMemoryPromptPreview,
} from "../lib/xagent/tavusMemoryPromptPreview.mjs";

const openGates = {
  XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED: "true",
  XAGENT_DANI_MEMORY_PROMPT_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_PROMPT_KILL_SWITCH: "false",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashSummary(summary) {
  return createHash("sha256").update(String(summary ?? "").replace(/\s+/g, " ").trim()).digest("hex");
}

async function assertNoServiceCalls(fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("Tavus memory prompt preview must not call live services");
  };
  try {
    const result = await fn();
    assert.deepEqual(calls, []);
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertPromptExcludesBackendData(prompt) {
  const forbiddenSubstrings = [
    "hxmr_",
    "hxmc_",
    "hxls_",
    "hxor_",
    "xagents/",
    "ca4ec4813b2a8413",
    "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59",
    "438757edfedc4a1fbbd89097609739f54e05988fc86332287ecf4e2d233dcf40",
    "e1c4bbfaada0a252ac67262b208950d8a3c8cbf2919505d2f958369194da1814",
    "c7355949b0cb28af3ef04f21e5cd7b8962744f93611fd9662194a629b8ed5493",
    "visitor_manual_live_tavus_test",
    "xagent_session_memory_recall_preview_001",
    "xagent_session_manual_live_tavus_test",
    "record_hash",
    "summary_hash",
  ];

  for (const forbidden of forbiddenSubstrings) {
    assert.equal(prompt.includes(forbidden), false, `prompt leaked ${forbidden}`);
  }
}

async function main() {
  assert.throws(
    () => buildGatedTavusMemoryPromptPreview(
      { ...clone(fixture), agent_slug: "wrong_agent_should_not_be_validated_when_gates_closed" },
      { env: {} },
    ),
    /XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED must be exactly true/,
  );

  assert.throws(
    () => buildGatedTavusMemoryPromptPreview(clone(fixture), {
      env: {
        XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED: "true",
        XAGENT_TAVUS_MEMORY_PROMPT_KILL_SWITCH: "false",
      },
    }),
    /XAGENT_DANI_MEMORY_PROMPT_PILOT_ENABLED must be exactly true/,
  );

  assert.throws(
    () => buildGatedTavusMemoryPromptPreview(clone(fixture), {
      env: {
        XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED: "true",
        XAGENT_DANI_MEMORY_PROMPT_PILOT_ENABLED: "true",
        XAGENT_TAVUS_MEMORY_PROMPT_KILL_SWITCH: "true",
      },
    }),
    /XAGENT_TAVUS_MEMORY_PROMPT_KILL_SWITCH must be exactly false/,
  );

  const preview = await assertNoServiceCalls(() => buildGatedTavusMemoryPromptPreview(clone(fixture), { env: openGates }));
  const prompt = preview.candidate_tavus_prompt_context;

  assert.equal(preview.dry_run_only, true);
  assert.equal(preview.prompt_preview_only, true);
  assert.equal(preview.agent_slug, "dani");
  assert.equal(preview.visitor_id, "visitor_manual_live_tavus_test");
  assert.equal(preview.next_session_id, "xagent_session_memory_recall_preview_001");
  assert.deepEqual(preview.prior_memory_record_ids, ["hxmr_f016484b62254c09"]);
  assert.match(prompt, /Internal continuity context for Dani/);
  assert.match(prompt, /Use this only as quiet background/);
  assert.match(prompt, /Prior context summary:/);
  assert.match(prompt, /The visitor inquired about how to effectively summarize Tavus conversations/);
  assert.match(prompt, /Forbidden actions and claims:/);
  assert.match(prompt, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assert.match(prompt, /Do not reveal hashes, namespaces, IDs, or backend machinery/);
  assert.match(prompt, /Do not say "I remember everything" or imply surveillance/);
  assert.match(prompt, /Dani may naturally continue from prior goals and preferences when relevant/);
  assert.match(prompt, /Dani should ask for confirmation before acting on prior context/);
  assertPromptExcludesBackendData(prompt);
  assert.equal(prompt.includes("person@example.com"), false);
  assert.equal(prompt.includes("4111"), false);
  assert.equal(prompt.includes("123-45-6789"), false);
  assert.equal(prompt.toLowerCase().includes("sk-"), false);
  assert.equal(preview.tavus_prompt_injection_performed, false);
  assert.equal(preview.conversation_start_mutated, false);
  assert.equal(preview.tavus_persona_mutated, false);
  assert.equal(preview.live_tavus_called, false);
  assert.equal(preview.live_hermes_called, false);
  assert.equal(preview.openai_called, false);
  assert.equal(preview.codex_openai_escalation, false);
  assert.equal(preview.ollama_generate_called, false);
  assert.equal(preview.resend_called, false);
  assert.equal(preview.production_database_mutated, false);
  assert.equal(preview.production_memory_database_mutated, false);
  assert.equal(preview.outbound_action_taken, false);
  assert.deepEqual(preview.allowed_use, fixture.allowed_use);
  assert.deepEqual(preview.forbidden_use, fixture.forbidden_use);

  assert.throws(
    () => buildTavusMemoryPromptPreview({ ...clone(fixture), agent_slug: "james" }),
    /agent_slug must be dani/,
  );
  assert.throws(
    () => buildTavusMemoryPromptPreview({ ...clone(fixture), recalled_memory_summary: "" }),
    /recalled_memory_summary is required/,
  );
  assert.throws(
    () => buildTavusMemoryPromptPreview({ ...clone(fixture), confidence: "" }),
    /confidence is required/,
  );
  assert.throws(
    () => buildTavusMemoryPromptPreview({ ...clone(fixture), provenance: undefined }),
    /provenance is required/,
  );

  for (const rawKey of ["raw_transcript", "content", "messages", "transcript_turns"]) {
    assert.throws(
      () => buildTavusMemoryPromptPreview({ ...clone(fixture), [rawKey]: "not allowed" }),
      /raw transcript\/content\/messages fields are not allowed/,
    );
  }

  assert.throws(
    () => {
      const mutated = clone(fixture);
      mutated.recalled_memory_summary = "The agent sent an email and updated the CRM.";
      mutated.provenance.summary_hash = hashSummary(mutated.recalled_memory_summary);
      return buildTavusMemoryPromptPreview(mutated);
    },
    /recalled_memory_summary contains outbound\/action claims/,
  );

  assert.throws(
    () => buildTavusMemoryPromptPreview({ ...clone(fixture), outbound_action_taken: true }),
    /\$\.outbound_action_taken must be false/,
  );

  const conversationStartRoute = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.equal(conversationStartRoute.includes("tavusMemoryPromptPreview"), false);
  assert.equal(conversationStartRoute.includes("XAGENT_TAVUS_MEMORY_PROMPT_PREVIEW_ENABLED"), false);
  assert.equal(conversationStartRoute.includes("candidate_tavus_prompt_context"), false);

  assert.equal(Object.hasOwn(preview, "transcript"), false);
  assert.equal(Object.hasOwn(preview, "messages"), false);
  assert.equal(Object.hasOwn(preview, "content"), false);

  console.log("Hermes Tavus memory prompt preview checks passed");
}

await main();
