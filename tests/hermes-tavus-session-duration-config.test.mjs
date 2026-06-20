import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCreateConversationBody } from "../lib/tavusCreateConversationBody.mjs";

async function main() {
  const configSource = await readFile("lib/config.ts", "utf8");
  assert.match(
    configSource,
    /DEMO_MAX_CALL_SECONDS \?\? "720"/,
    "DEMO_MAX_CALL_SECONDS should default to 720 seconds",
  );

  const previewSource = await readFile("lib/xagent/tavusConversationStartMemoryPreview.mjs", "utf8");
  assert.match(
    previewSource,
    /numericEnv\("DEMO_MAX_CALL_SECONDS", "720"\)/,
    "conversation payload preview should use the same 720 second fallback",
  );

  const body = buildCreateConversationBody({
    personaId: "persona_duration_test",
    replicaId: "replica_duration_test",
    maxCallSeconds: 720,
    absentTimeout: 30,
    leftTimeout: 5,
  });

  assert.equal(body.properties.max_call_duration, 720);
  assert.equal(body.properties.participant_absent_timeout, 30);
  assert.equal(body.properties.participant_left_timeout, 5);

  console.log("Hermes Tavus session duration config checks passed");
}

await main();
