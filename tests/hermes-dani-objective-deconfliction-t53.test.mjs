import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_DANI_OBJECTIVE_DECONFLICTION_T53.md", "utf8");

function includes(text) {
  assert.equal(doc.includes(text), true, `Expected doc to include: ${text}`);
}

includes("# Hermes Dani Objective Deconfliction T53");
includes("The operator removed the Dani Objective set from the Tavus site");
includes("Keep this document as a rollback reference only.");
includes("Do not reattach the Objective set while debugging returning-user memory behavior.");
includes("dani_welcome_scope");
includes("Confirm the user understands this is a live demo");
includes("dani_interest_classification");
includes("lead qualification, support intake, operations automation");
includes("stacked questions");
includes("returning-user continuity and direct memory recap");
includes("Hermes is the background backend worker/action layer.");
includes("Hermes is not currently the real-time voice turn controller.");
includes("Tavus persona instructions, Tavus Objectives, the custom greeting, and injected `conversational_context` shape what Dani says.");
includes("Do not reattach Dani Objectives until all of these are true:");
includes("A returning visitor can ask for a recap and receive one directly from approved memory.");
includes("Multi-session memory aggregation is implemented or explicitly scoped.");
includes("If Dani Objectives are reintroduced, the next graph should start from memory continuity:");

const removedNames = [
  "dani_welcome_scope",
  "dani_interest_classification",
  "dani_lead_quality_path",
  "dani_support_intake_path",
  "dani_ops_automation_path",
  "dani_platform_explainer_path",
  "dani_objection_handling_path",
  "dani_implementation_readiness_path",
  "dani_lead_capture_path",
  "dani_general_path",
  "dani_next_step_summary",
];

for (const name of removedNames) {
  includes(name);
}

console.log("Hermes Dani objective deconfliction T53 checks passed");
