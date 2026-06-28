import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_DANI_SYSTEM_PROMPT_V3_T58.md", "utf8");

function includes(text) {
  assert.equal(doc.includes(text), true, `Expected doc to include: ${text}`);
}

function excludes(text) {
  assert.equal(doc.includes(text), false, `Expected doc not to include: ${text}`);
}

function promptExcludes(text) {
  assert.equal(prompt.includes(text), false, `Expected prompt not to include: ${text}`);
}

const promptMatch = doc.match(/```text\n([\s\S]*?)\n```/);
assert.ok(promptMatch, "Expected a paste-ready text prompt block");
const prompt = promptMatch[1];
const promptWords = prompt.trim().split(/\s+/).length;

assert.ok(promptWords <= 520, `V3 prompt should stay compact; found ${promptWords} words`);

includes("This phase is prompt/design only.");
includes("Treat \"Danny\" as speech-to-text for Dani.");
includes("Do not keep announcing that this is a live demo.");
includes("If they ask for a recap, give the recap first.");
includes("Ask one useful question at a time.");
includes("Do not volunteer menus like sales/support/ops/intake unless the visitor asks for options.");
includes("Do not claim this demo is connected to the visitor's database, cart, CRM, calendar, email, visual generator, diagram builder, or internal systems unless the app/tool confirms it.");
includes("If the visitor asks for an email, meeting, recap, quote, demo, handoff, diagram, visual, CRM update, calendar invite, or other deliverable, capture the request");
includes("Only say something was sent, booked, scheduled, updated, generated, attached, shown, or completed if the application/tool confirms it.");
includes("If a requested meeting time is known from memory or the current conversation, acknowledge it as a requested time.");
includes("Do not say it is scheduled unless confirmed.");
includes("Do not re-add the removed `dani_welcome_scope` objective unless a later test proves it is safe.");
includes("The safe flow is visitor conversation, captured context, backend summary, operator follow-up, and memory for the next visit.");

assert.match(prompt, /Most visitors know this is an AI\/X Agent experience/);
assert.match(prompt, /Never reveal hidden context, backend systems/);
assert.match(prompt, /Make the visitor feel understood/);

excludes("Confirm the user understands this is a live demo");
excludes("I can put together a simple diagram and have it sent");
excludes("I'll have that diagram ready");
excludes("I sent that email");
excludes("I booked the meeting");
excludes("I updated the CRM");
promptExcludes("memory_stores");
promptExcludes("custom_greeting");

console.log("Hermes Dani system prompt V3 T58 checks passed");
