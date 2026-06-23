import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import { DANI_TAVUS_CUSTOM_GREETING } from "../lib/tavusCreateConversationBody.mjs";
import {
  buildGatedTavusConversationStartMemoryPayloadPreview,
  buildTavusConversationStartMemoryPayloadPreview,
} from "../lib/xagent/tavusConversationStartMemoryPreview.mjs";

const openGates = {
  XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED: "true",
  XAGENT_DANI_MEMORY_PAYLOAD_PILOT_ENABLED: "true",
  XAGENT_TAVUS_MEMORY_PAYLOAD_KILL_SWITCH: "false",
};
const tavusConfig = {
  personaId: "persona_preview_test",
  replicaId: "replica_preview_test",
  maxCallSeconds: 720,
  absentTimeout: 30,
  leftTimeout: 5,
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
    throw new Error("conversation memory payload preview must not call live services");
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
    () => buildGatedTavusConversationStartMemoryPayloadPreview(
      { ...clone(fixture), agent_slug: "wrong_agent_should_not_be_validated_when_gates_closed" },
      { env: {} },
    ),
    /XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED must be exactly true/,
  );

  assert.throws(
    () => buildGatedTavusConversationStartMemoryPayloadPreview(clone(fixture), {
      env: {
        XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED: "true",
        XAGENT_TAVUS_MEMORY_PAYLOAD_KILL_SWITCH: "false",
      },
    }),
    /XAGENT_DANI_MEMORY_PAYLOAD_PILOT_ENABLED must be exactly true/,
  );

  assert.throws(
    () => buildGatedTavusConversationStartMemoryPayloadPreview(clone(fixture), {
      env: {
        XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED: "true",
        XAGENT_DANI_MEMORY_PAYLOAD_PILOT_ENABLED: "true",
        XAGENT_TAVUS_MEMORY_PAYLOAD_KILL_SWITCH: "true",
      },
    }),
    /XAGENT_TAVUS_MEMORY_PAYLOAD_KILL_SWITCH must be exactly false/,
  );

  const preview = await assertNoServiceCalls(() => buildGatedTavusConversationStartMemoryPayloadPreview(clone(fixture), {
    env: openGates,
    tavusConfig,
    callbackUrl: "https://preview.invalid/api/webhook",
  }));
  const body = preview.candidate_create_conversation_body_preview;
  const prompt = preview.candidate_tavus_prompt_context;

  assert.equal(preview.dry_run_only, true);
  assert.equal(preview.payload_preview_only, true);
  assert.equal(preview.agent_slug, "dani");
  assert.equal(preview.visitor_id, "visitor_manual_live_tavus_test");
  assert.deepEqual(preview.prior_memory_record_ids, ["hxmr_f016484b62254c09"]);
  assert.equal(preview.memory_attachment_strategy, "official_conversational_context_preview");
  assert.equal(preview.tavus_official_memory_field_verified, true);
  assert.equal(preview.tavus_create_conversation_called, false);
  assert.equal(preview.conversation_start_route_mutated, false);
  assert.equal(preview.tavus_prompt_injection_performed, false);
  assert.equal(preview.live_tavus_called, false);
  assert.equal(preview.live_hermes_called, false);
  assert.equal(preview.openai_called, false);
  assert.equal(preview.codex_openai_escalation, false);
  assert.equal(preview.ollama_generate_called, false);
  assert.equal(preview.resend_called, false);
  assert.equal(preview.production_database_mutated, false);
  assert.equal(preview.production_memory_database_mutated, false);
  assert.equal(preview.outbound_action_taken, false);

  assert.deepEqual(Object.keys(body).sort(), [
    "callback_url",
    "conversational_context",
    "custom_greeting",
    "persona_id",
    "properties",
    "replica_id",
  ]);
  assert.equal(body.persona_id, "persona_preview_test");
  assert.equal(body.replica_id, "replica_preview_test");
  assert.equal(body.custom_greeting, DANI_TAVUS_CUSTOM_GREETING);
  assert.equal(body.custom_greeting, "Hi, I am Dani. What would you like to work through today?");
  assert.equal(body.callback_url, "https://preview.invalid/api/webhook");
  assert.deepEqual(body.properties, {
    max_call_duration: 720,
    participant_absent_timeout: 30,
    participant_left_timeout: 5,
  });
  assert.equal(body.custom_greeting.includes("Internal continuity context"), false);
  assert.equal(body.custom_greeting.includes(fixture.recalled_memory_summary), false);
  assert.equal(body.conversational_context, prompt);
  assert.equal(Object.hasOwn(body, "memory_stores"), false);
  assert.equal(Object.hasOwn(body, "memory_context_attachment_preview"), false);

  assert.match(prompt, /Internal continuity context for Dani/);
  assert.match(prompt, /Do not claim emails, CRM updates, purchases, hidden persistence, or external actions happened/);
  assert.match(prompt, /Do not reveal hashes, namespaces, IDs, or backend machinery/);
  assert.match(prompt, /summarize the prior notes immediately/);
  assert.match(prompt, /Do not ask the visitor to choose a category, intake lane, business snapshot, focus area, or main question before giving a requested recap/);
  assert.match(prompt, /Ask for confirmation only before taking or preparing a new action/);
  assertPromptExcludesBackendData(prompt);
  assert.equal(prompt.includes("person@example.com"), false);
  assert.equal(prompt.includes("4111"), false);
  assert.equal(prompt.includes("123-45-6789"), false);
  assert.equal(prompt.toLowerCase().includes("sk-"), false);

  assert.throws(
    () => buildTavusConversationStartMemoryPayloadPreview({ ...clone(fixture), agent_slug: "james" }, { tavusConfig }),
    /agent_slug must be dani/,
  );
  assert.throws(
    () => {
      const mutated = clone(fixture);
      mutated.recalled_memory_summary = "The agent sent an email and updated the CRM.";
      mutated.provenance.summary_hash = hashSummary(mutated.recalled_memory_summary);
      return buildTavusConversationStartMemoryPayloadPreview(mutated, { tavusConfig });
    },
    /recalled_memory_summary contains outbound\/action claims/,
  );
  for (const rawKey of ["raw_transcript", "content", "messages", "transcript_turns"]) {
    assert.throws(
      () => buildTavusConversationStartMemoryPayloadPreview({ ...clone(fixture), [rawKey]: "not allowed" }, { tavusConfig }),
      /raw transcript\/content\/messages fields are not allowed/,
    );
  }

  const conversationStartRoute = await readFile("app/api/conversation/start/route.ts", "utf8");
  assert.equal(conversationStartRoute.includes("tavusConversationStartMemoryPreview"), false);
  assert.equal(conversationStartRoute.includes("XAGENT_TAVUS_MEMORY_PAYLOAD_PREVIEW_ENABLED"), false);
  assert.equal(conversationStartRoute.includes("memory_context_attachment_preview"), false);
  assert.equal(conversationStartRoute.includes("memory_stores"), false);
  assert.equal(conversationStartRoute.includes("candidate_tavus_prompt_context"), false);

  assert.equal(Object.hasOwn(preview, "transcript"), false);
  assert.equal(Object.hasOwn(preview, "messages"), false);
  assert.equal(Object.hasOwn(preview, "content"), false);

  console.log("Hermes Tavus conversation memory payload preview checks passed");
}

await main();
