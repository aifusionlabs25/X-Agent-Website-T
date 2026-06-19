import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fixture from "./fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  buildGatedSessionStartMemoryContextPreview,
  buildSessionStartMemoryContextPreview,
} from "../lib/xagent/sessionMemoryContext.mjs";

const openGates = {
  XAGENT_MEMORY_CONTEXT_PREVIEW_ENABLED: "true",
  XAGENT_DANI_MEMORY_CONTEXT_PILOT_ENABLED: "true",
  XAGENT_MEMORY_CONTEXT_KILL_SWITCH: "false",
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
    throw new Error("session memory context preview must not call live services");
  };
  try {
    const result = await fn();
    assert.deepEqual(calls, []);
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  assert.throws(
    () => buildGatedSessionStartMemoryContextPreview(
      { ...clone(fixture), agent_slug: "wrong_agent_should_not_be_validated_when_gates_closed" },
      { env: {} },
    ),
    /XAGENT_MEMORY_CONTEXT_PREVIEW_ENABLED must be exactly true/,
  );

  assert.throws(
    () => buildGatedSessionStartMemoryContextPreview(clone(fixture), {
      env: {
        XAGENT_MEMORY_CONTEXT_PREVIEW_ENABLED: "true",
        XAGENT_MEMORY_CONTEXT_KILL_SWITCH: "false",
      },
    }),
    /XAGENT_DANI_MEMORY_CONTEXT_PILOT_ENABLED must be exactly true/,
  );

  assert.throws(
    () => buildGatedSessionStartMemoryContextPreview(clone(fixture), {
      env: {
        XAGENT_MEMORY_CONTEXT_PREVIEW_ENABLED: "true",
        XAGENT_DANI_MEMORY_CONTEXT_PILOT_ENABLED: "true",
        XAGENT_MEMORY_CONTEXT_KILL_SWITCH: "true",
      },
    }),
    /XAGENT_MEMORY_CONTEXT_KILL_SWITCH must be exactly false/,
  );

  const preview = await assertNoServiceCalls(() => buildGatedSessionStartMemoryContextPreview(clone(fixture), { env: openGates }));

  assert.equal(preview.dry_run_only, true);
  assert.equal(preview.memory_context_preview_enabled, true);
  assert.equal(preview.agent_slug, "dani");
  assert.equal(preview.tenant_id, "ai-fusion-labs");
  assert.equal(preview.visitor_id, "visitor_manual_live_tavus_test");
  assert.equal(preview.next_session_id, "xagent_session_memory_recall_preview_001");
  assert.equal(preview.visitor_memory_namespace, "xagents/ai-fusion-labs/dani/visitor_manual_live_tavus_test");
  assert.deepEqual(preview.prior_memory_record_ids, ["hxmr_f016484b62254c09"]);
  assert.equal(preview.recalled_memory_summary.startsWith("The visitor inquired"), true);
  assert.equal(preview.confidence, 0.72);
  assert.deepEqual(preview.allowed_use, fixture.allowed_use);
  assert.deepEqual(preview.forbidden_use, fixture.forbidden_use);
  assert.equal(preview.provenance.summary_hash, "88491412b37f46615fd1be09bd98fb18ad2031012b208e491893bfb4c33d2f59");
  assert.equal(preview.provenance.record_hash, "c7355949b0cb28af3ef04f21e5cd7b8962744f93611fd9662194a629b8ed5493");
  assert.equal(preview.provenance.record_hash_verified, true);
  assert.equal(preview.provenance.summary_hash_verified, true);
  assert.equal(preview.tavus_prompt_injection_performed, false);
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

  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), agent_slug: "james" }),
    /agent_slug must be dani/,
  );
  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), visitor_memory_namespace: "" }),
    /visitor_memory_namespace is required/,
  );
  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), visitor_memory_namespace: "xagents\/ai-fusion-labs\/dani\/other" }),
    /visitor_memory_namespace must match tenant, agent, and visitor/,
  );
  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), recalled_memory_summary: "" }),
    /recalled_memory_summary is required/,
  );
  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), confidence: "" }),
    /confidence is required/,
  );
  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), provenance: undefined }),
    /provenance is required/,
  );
  assert.throws(
    () => {
      const mutated = clone(fixture);
      mutated.provenance.summary_hash = "";
      return buildSessionStartMemoryContextPreview(mutated);
    },
    /provenance.summary_hash is required/,
  );
  assert.throws(
    () => {
      const mutated = clone(fixture);
      mutated.provenance.record_hash = "";
      return buildSessionStartMemoryContextPreview(mutated);
    },
    /provenance.record_hash is required/,
  );
  assert.throws(
    () => {
      const mutated = clone(fixture);
      mutated.provenance.record_hash_verified = false;
      return buildSessionStartMemoryContextPreview(mutated);
    },
    /provenance.record_hash_verified must be true/,
  );

  for (const rawKey of ["raw_transcript", "content", "messages", "transcript_turns"]) {
    assert.throws(
      () => buildSessionStartMemoryContextPreview({ ...clone(fixture), [rawKey]: "not allowed" }),
      /raw transcript\/content\/messages fields are not allowed/,
    );
  }

  assert.throws(
    () => {
      const mutated = clone(fixture);
      mutated.recalled_memory_summary = "The agent sent an email and updated the CRM.";
      mutated.provenance.summary_hash = hashSummary(mutated.recalled_memory_summary);
      return buildSessionStartMemoryContextPreview(mutated);
    },
    /recalled_memory_summary contains outbound\/action claims/,
  );

  assert.throws(
    () => buildSessionStartMemoryContextPreview({ ...clone(fixture), outbound_action_taken: true }),
    /\$\.outbound_action_taken must be false/,
  );

  assert.equal(Object.hasOwn(preview, "transcript"), false);
  assert.equal(Object.hasOwn(preview, "messages"), false);
  assert.equal(Object.hasOwn(preview, "content"), false);
  assert.equal(JSON.stringify(preview).includes("person@example.com"), false);
  assert.equal(JSON.stringify(preview).includes("4111"), false);
  assert.equal(JSON.stringify(preview).includes("123-45-6789"), false);
  assert.equal(JSON.stringify(preview).toLowerCase().includes("sk-"), false);

  console.log("Hermes session-start memory context preview checks passed");
}

await main();
