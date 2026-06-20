import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildEmailMemoryPreviewUiGateStatus,
  isEmailMemoryPreviewUiEnabled,
} from "../lib/xagent/emailMemoryPreviewUi.mjs";

assert.equal(isEmailMemoryPreviewUiEnabled({}), false);
assert.equal(isEmailMemoryPreviewUiEnabled({ XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED: "false" }), false);
assert.equal(isEmailMemoryPreviewUiEnabled({ XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED: "true" }), true);

const closedGate = buildEmailMemoryPreviewUiGateStatus({});
assert.equal(closedGate.email_memory_preview_ui_enabled, false);
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

const openGate = buildEmailMemoryPreviewUiGateStatus({ XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED: "true" });
assert.equal(openGate.email_memory_preview_ui_enabled, true);

const pageSource = await readFile("app/admin/hermes-email-memory-preview/page.tsx", "utf8");
assert.match(pageSource, /buildEmailMemoryPreviewUiGateStatus/);
assert.match(pageSource, /dynamic = "force-dynamic"/);
assert.match(pageSource, /Preview UI disabled/);
assert.match(pageSource, /EmailMemoryPreviewClient/);
assert.equal(pageSource.includes("/api/conversation/start"), false);
assert.equal(pageSource.includes("createConversation"), false);
assert.equal(pageSource.includes("memory_stores"), false);
assert.equal(pageSource.includes("custom_greeting"), false);

const clientSource = await readFile("app/admin/hermes-email-memory-preview/EmailMemoryPreviewClient.tsx", "utf8");
assert.match(clientSource, /"use client"/);
assert.match(clientSource, /\/api\/xagent\/email-memory-lookup\/dry-run/);
assert.match(clientSource, /EMAIL_SHAPE/);
assert.match(clientSource, /SAFE_FIELDS/);
assert.match(clientSource, /setEmail\(""\)/);
assert.equal(clientSource.includes("useEffect"), false);
assert.equal(clientSource.includes("/api/conversation/start"), false);
assert.equal(clientSource.includes("createConversation"), false);
assert.equal(clientSource.includes("conversation_url"), false);
assert.match(clientSource, /email_identity_hash_derived/);
assert.match(clientSource, /memory_context_preview_available/);
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
assert.equal(clientSource.includes("dani.email.identity.fixture@example.invalid"), false);
assert.equal(clientSource.includes("50fd4f46d1839fc9d426b9a20f7c17150689f629be8d8bc0f0a0d70007e17c7b"), false);

const doc = await readFile("docs/HERMES_EMAIL_MEMORY_LOOKUP_PREVIEW_T36.md", "utf8");
assert.match(doc, /XAGENT_EMAIL_MEMORY_LOOKUP_ENABLED=true/);
assert.match(doc, /XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED=true/);
assert.match(doc, /POST \/api\/xagent\/email-memory-lookup\/dry-run/);
assert.match(doc, /does not wire email lookup into `\/api\/conversation\/start`/);
assert.equal(doc.includes("dani.email.identity.fixture@example.invalid"), false);
assert.equal(doc.includes("50fd4f46d1839fc9d426b9a20f7c17150689f629be8d8bc0f0a0d70007e17c7b"), false);
assert.equal(doc.includes("h-email-2-fixture-only-non-production-salt"), false);
assert.equal(doc.includes("Internal continuity context"), false);
assert.equal(doc.includes("Visitor is evaluating Dani"), false);
assert.equal(doc.includes("hxeimc_"), false);
assert.equal(doc.includes("xagents/ai-fusion-labs/dani/email/"), false);
assert.equal(doc.includes("TAVUS_API_KEY"), false);

const tavusPlayerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(tavusPlayerSource, /fetch\('\/api\/conversation\/start', \{ method: 'POST' \}\)/);
assert.equal(tavusPlayerSource.includes("email"), false);
assert.equal(tavusPlayerSource.includes("email_identity_hash"), false);
assert.equal(tavusPlayerSource.includes("memory_context"), false);
assert.equal(tavusPlayerSource.includes("JSON.stringify"), false);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:hermes-email-memory-preview-ui-t36"],
  "node tests/hermes-email-memory-preview-ui-t36.test.mjs",
);

console.log("Hermes email memory preview UI T36 checks passed");
