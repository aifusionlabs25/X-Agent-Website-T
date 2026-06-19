import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHermesLocalJobFile,
  validateHermesDispatchPayload,
  writeHermesLocalJobFile,
} from "../lib/xagent/hermesDispatchHandoff.mjs";
import { buildSessionCompletedPayload } from "../lib/xagent/sessionCompletedPayload.mjs";

const payload = buildSessionCompletedPayload({
  tenant_id: "ai-fusion-labs",
  agent_slug: "dani",
  visitor_id: "visitor_test_001",
  session_id: "xagent_session_test_001",
  provider: "tavus",
  provider_conversation_id: "tavus_conversation_test_001",
  completed_at: "2026-06-18T21:03:00Z",
  transcript: [
    { role: "user", content: "Reach me at visitor@example.com about lead handoffs." },
    { role: "agent", content: "Dani explained this is only a dry-run handoff skeleton." },
  ],
});

const sourceProofPath = "docs/proofs/hermes_tavus_live_transcript_dry_run_ca4ec4813b2a8413.json";

async function assertNoFiles(dir) {
  try {
    assert.deepEqual(await readdir(dir), []);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

const outboxDir = await mkdtemp(join(tmpdir(), "hermes-handoff-"));

await assert.rejects(
  () => writeHermesLocalJobFile(payload, {
    env: { XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR: outboxDir },
    sourceProofPath,
  }),
  /XAGENT_HERMES_DISPATCH_ENABLED must be exactly true/,
);
await assertNoFiles(outboxDir);

await assert.rejects(
  () => writeHermesLocalJobFile(payload, {
    env: {
      XAGENT_HERMES_DISPATCH_ENABLED: "true",
      XAGENT_HERMES_DISPATCH_KILL_SWITCH: "false",
      XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR: outboxDir,
    },
    sourceProofPath,
  }),
  /XAGENT_HERMES_DANI_PILOT_ENABLED must be exactly true/,
);
await assertNoFiles(outboxDir);

await assert.rejects(
  () => writeHermesLocalJobFile(payload, {
    env: {
      XAGENT_HERMES_DISPATCH_ENABLED: "true",
      XAGENT_HERMES_DANI_PILOT_ENABLED: "true",
      XAGENT_HERMES_DISPATCH_KILL_SWITCH: "true",
      XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR: outboxDir,
    },
    sourceProofPath,
  }),
  /XAGENT_HERMES_DISPATCH_KILL_SWITCH must be exactly false/,
);
await assertNoFiles(outboxDir);

await assert.rejects(
  () => writeHermesLocalJobFile(payload, {
    env: {
      XAGENT_HERMES_DISPATCH_ENABLED: "true",
      XAGENT_HERMES_DANI_PILOT_ENABLED: "true",
      XAGENT_HERMES_DISPATCH_KILL_SWITCH: "false",
    },
    sourceProofPath,
  }),
  /XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR is required/,
);

assert.throws(() => validateHermesDispatchPayload({ ...payload, agent_slug: "james" }), /agent_slug must be dani/);
assert.throws(() => validateHermesDispatchPayload({ ...payload, provider: "anam" }), /provider must be tavus/);
assert.throws(
  () => validateHermesDispatchPayload({ ...payload, allowed_operations: ["send_email"] }),
  /allowed_operations must be exactly/,
);
assert.throws(
  () => validateHermesDispatchPayload({ ...payload, requested_operation: "send_email" }),
  /requested_operation must be summarize_session_for_memory/,
);
assert.throws(() => validateHermesDispatchPayload({ ...payload, idempotency_key: "" }), /idempotency_key is required/);
assert.throws(() => validateHermesDispatchPayload({ ...payload, transcript_hash: "" }), /transcript_hash is required/);

const localOutboxDir = await mkdtemp(join(tmpdir(), "hermes-handoff-enabled-"));
const env = {
  XAGENT_HERMES_DISPATCH_ENABLED: "true",
  XAGENT_HERMES_DANI_PILOT_ENABLED: "true",
  XAGENT_HERMES_DISPATCH_KILL_SWITCH: "false",
  XAGENT_HERMES_LOCAL_JOB_OUTBOX_DIR: localOutboxDir,
};

const first = await writeHermesLocalJobFile(payload, { env, sourceProofPath });
const second = await writeHermesLocalJobFile(payload, { env, sourceProofPath });
const files = await readdir(localOutboxDir);
const persisted = JSON.parse(await readFile(first.local_job_file_path, "utf8"));
const serialized = JSON.stringify(persisted);

assert.equal(first.local_job_file_written, true);
assert.equal(first.local_job_file_path, second.local_job_file_path);
assert.deepEqual(first.job, second.job);
assert.equal(files.length, 1);
assert.deepEqual(persisted, buildHermesLocalJobFile(payload, { sourceProofPath }));
assert.equal(persisted.job_type, "xagent.session.completed.summarize_session_for_memory");
assert.equal(persisted.dispatch_mode, "disabled_local_file_handoff");
assert.equal(persisted.operator_review_required, true);
assert.equal(persisted.raw_transcript_included, false);
assert.equal(persisted.hermes_dispatched, false);
assert.equal(persisted.live_hermes_called, false);
assert.equal(persisted.outbound_action_taken, false);
assert.equal(persisted.production_database_mutated, false);
assert.equal(persisted.codex_openai_escalation, false);
assert.equal(persisted.ollama_generate_called, false);
assert.equal(persisted.resend_called, false);
assert.equal(persisted.source_proof_path, sourceProofPath);
assert.equal(Object.hasOwn(persisted, "transcript"), false);
assert.equal(Object.hasOwn(persisted, "content"), false);
assert.equal(Object.hasOwn(persisted, "messages"), false);
assert.equal(serialized.includes("visitor@example.com"), false);
assert.deepEqual(persisted.allowed_operations, ["summarize_session_for_memory"]);

await rm(outboxDir, { recursive: true, force: true });
await rm(localOutboxDir, { recursive: true, force: true });

console.log("Hermes local dispatch handoff skeleton checks passed");
