import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildReturnCodePreviewUiGateStatus,
  isReturnCodePreviewUiEnabled,
} from "../lib/xagent/returnCodePreviewUi.mjs";

assert.equal(isReturnCodePreviewUiEnabled({}), false);
assert.equal(isReturnCodePreviewUiEnabled({ XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED: "false" }), false);
assert.equal(isReturnCodePreviewUiEnabled({ XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED: "true" }), true);

const closedGate = buildReturnCodePreviewUiGateStatus({});
assert.equal(closedGate.return_code_preview_ui_enabled, false);
assert.equal(closedGate.private_preview_only, true);
assert.equal(closedGate.public_button_flow_changed, false);
assert.equal(closedGate.tavus_create_conversation_called, false);
assert.equal(closedGate.live_tavus_called, false);
assert.equal(closedGate.live_hermes_called, false);
assert.equal(closedGate.openai_called, false);
assert.equal(closedGate.ollama_generate_called, false);
assert.equal(closedGate.resend_called, false);
assert.equal(closedGate.production_database_mutated, false);
assert.equal(closedGate.production_memory_persistence_used, false);
assert.equal(closedGate.outbound_action_taken, false);

const openGate = buildReturnCodePreviewUiGateStatus({ XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED: "true" });
assert.equal(openGate.return_code_preview_ui_enabled, true);

const pageSource = await readFile("app/admin/hermes-return-code-preview/page.tsx", "utf8");
assert.match(pageSource, /buildReturnCodePreviewUiGateStatus/);
assert.match(pageSource, /dynamic = "force-dynamic"/);
assert.match(pageSource, /Preview UI disabled/);
assert.match(pageSource, /ReturnCodePreviewClient/);
assert.equal(pageSource.includes("/api/conversation/start"), false);
assert.equal(pageSource.includes("createConversation"), false);
assert.equal(pageSource.includes("memory_stores"), false);
assert.equal(pageSource.includes("custom_greeting"), false);

const clientSource = await readFile("app/admin/hermes-return-code-preview/ReturnCodePreviewClient.tsx", "utf8");
assert.match(clientSource, /"use client"/);
assert.match(clientSource, /\/api\/xagent\/return-code-conversation-start\/dry-run/);
assert.match(clientSource, /RETURN_CODE_PATTERN/);
assert.match(clientSource, /SAFE_FIELDS/);
assert.equal(clientSource.includes("useEffect"), false);
assert.equal(clientSource.includes("/api/conversation/start"), false);
assert.equal(clientSource.includes("createConversation"), false);
assert.equal(clientSource.includes("conversation_url"), false);
assert.match(clientSource, /tavus_conversational_context_attached/);
assert.equal(clientSource.includes("candidate_tavus_prompt_context"), false);
assert.equal(clientSource.includes("conversationalContext"), false);
assert.equal(clientSource.includes("recalled_memory_summary"), false);
assert.equal(clientSource.includes("memory_namespace"), false);
assert.equal(clientSource.includes("visitor_memory_namespace"), false);
assert.equal(clientSource.includes("summary_hash"), false);
assert.equal(clientSource.includes("record_hash"), false);
assert.equal(clientSource.includes("transcript"), false);
assert.equal(clientSource.includes("messages"), false);
assert.equal(clientSource.includes("api_key"), false);
assert.equal(clientSource.includes("DANI-RET-K7P4-M9Q2-T6VA"), false);

const doc = await readFile("docs/HERMES_RETURN_CODE_PREVIEW_UI_T33.md", "utf8");
assert.match(doc, /XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED=true/);
assert.match(doc, /POST \/api\/xagent\/return-code-conversation-start\/dry-run/);
assert.equal(doc.includes("fetch('/api/conversation/start', { method: 'POST' })"), true);
assert.equal(doc.includes("DANI-RET-K7P4-M9Q2-T6VA"), false);
assert.equal(doc.includes("daily.co"), false);
assert.equal(doc.includes("tavus.daily"), false);
assert.equal(doc.includes("The visitor inquired"), false);
assert.equal(doc.includes("Internal continuity context"), false);
assert.equal(doc.includes("hxmr_"), false);
assert.equal(doc.includes("xagents/"), false);

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("return_code"), false);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:hermes-return-code-preview-ui-t33"],
  "node tests/hermes-return-code-preview-ui-t33.test.mjs",
);

console.log("Hermes return-code preview UI T33 checks passed");
