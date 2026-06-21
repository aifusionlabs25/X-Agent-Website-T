import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_DANI_MEMORY_BEHAVIOR_T44.md", "utf8");
const promptSource = await readFile("lib/xagent/tavusMemoryPromptPreview.mjs", "utf8");
const memoryStoreSource = await readFile("lib/xagent/emailMemoryStore.mjs", "utf8");

function includes(source, text) {
  assert.equal(source.includes(text), true, `Expected text: ${text}`);
}

includes(doc, "The rule is not \"Dani can never do these.\"");
includes(doc, "Dani may only claim the action was completed after the app/tool/backend confirms it.");
includes(doc, "Apply the T43 persona prompt inside Tavus.");
includes(doc, "redacts email-like text inside a turn instead of dropping the whole turn");
includes(doc, "safe assistant-side next-step details are now considered for scheduling memory");
includes(promptSource, "returning-user memory is available");
includes(promptSource, "app-owned contact identity from the website check-in");
includes(promptSource, "Do not ask the visitor for their email just to retrieve memory");
includes(promptSource, "Do not ask for email again as a prerequisite for a recap, meeting, or quote");
includes(promptSource, "When future app tools confirm an outbound action, Dani may state that confirmed result truthfully.");
includes(memoryStoreSource, "redactEmailLikeMemoryText");
includes(memoryStoreSource, "softenUnconfirmedOutboundClaims");
includes(memoryStoreSource, "Visitor/business context");
includes(memoryStoreSource, "Implementation notes");
includes(memoryStoreSource, "Success or scale signals");
includes(memoryStoreSource, "Next-step signals");

console.log("Hermes Dani memory behavior T44 checks passed");
