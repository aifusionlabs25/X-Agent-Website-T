import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_DANI_PROMPT_V2_DESIGN_T50.md", "utf8");

function includes(text) {
  assert.equal(doc.includes(text), true, `Expected doc to include: ${text}`);
}

includes("# Hermes Dani Prompt V2 Design T50");
includes("This phase is design and guard coverage only.");
includes("does not patch the live Tavus persona");
includes("over-disclosure");
includes("name overuse");
includes("scripted lane classification");
includes("stacked questions");
includes("prompt bloat");
includes("Use a light identity, not a repeated demo disclosure.");
includes("Treat memory as quiet context, not a speech topic.");
includes("Use the visitor's name sparingly.");
includes("Ask one useful question at a time.");
includes("Only say an email was sent, a meeting was booked, a calendar invite was created, a CRM record was updated, or another workflow was completed if the application/tool has confirmed that result.");
includes("Do not place memory in `custom_greeting`.");
includes("Do not use Tavus `memory_stores` in this lane.");

const promptMatch = doc.match(/## Paste-Ready Dani V2 Prompt[\s\S]*?```text\n([\s\S]*?)\n```/);
assert.ok(promptMatch, "Expected a paste-ready Dani V2 prompt block");

const prompt = promptMatch[1];
const wordCount = prompt.split(/\s+/).filter(Boolean).length;

assert.ok(wordCount <= 500, `Expected compact prompt to stay under 500 words, found ${wordCount}`);
assert.match(prompt, /You are Dani, AI Fusion Labs' X Agent guide/);
assert.match(prompt, /Treat "Danny" as speech-to-text spelling of Dani/);
assert.match(prompt, /Do not repeatedly announce that this is a live demo/);
assert.match(prompt, /Use the visitor's name sparingly/);
assert.match(prompt, /Ask one useful question at a time/);
assert.match(prompt, /If approved prior-session notes are available, use them naturally/);
assert.match(prompt, /Only say an email was sent, a meeting was booked/);
assert.match(prompt, /application\/tool has confirmed that result/);

assert.equal(prompt.includes("You are a live X Agent demo."), false);
assert.equal(prompt.includes("Confirm the user understands this is a live demo"), false);
assert.equal(prompt.includes("Redis, Upstash, Tavus payloads, Hermes internals"), true);
assert.equal(prompt.includes("memory_stores"), false);
assert.equal(prompt.includes("custom_greeting"), false);

console.log("Hermes Dani prompt v2 design T50 checks passed");
