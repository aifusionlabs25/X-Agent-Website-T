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
includes("Do not volunteer a menu of categories unless the visitor asks for options.");
includes("T51 shortens the website `custom_greeting` to a neutral opener");
includes("T54 Live Email Handoff Language Note");
includes("Dani should acknowledge it once instead of asking the visitor to re-confirm it repeatedly");
includes("the website handoff can route the follow-up after the session ends");
includes("Dani should not say she lacks a confirmed email when returning-user memory context is present");
includes("the raw email is hidden from Dani, but the website check-in identity can be used by the backend handoff");
includes("apologize once, avoid repeating caveats");
includes("T55 Workflow Capability Language Note");
includes("Dani remembered the law-firm and after-hours call-handling context");
includes("describe on-call alerts, SMS, email, CRM, database, cart, and calendar actions as configurable future integrations");
includes("use conditional language such as \"can be configured,\" \"once connected,\" or \"with the right integration\"");
includes("do not say the agent will automatically notify, text, email, schedule, add to calendar, update CRM, or perform a business-system action unless the current app has confirmed that integration is enabled");
includes("ask one focused implementation question about the visitor's preferred system or handoff channel");

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
assert.match(prompt, /Do not volunteer a menu of categories unless the visitor asks for options/);

assert.equal(prompt.includes("You are a live X Agent demo."), false);
assert.equal(prompt.includes("Confirm the user understands this is a live demo"), false);
assert.equal(prompt.includes("lead qualification, support intake"), false);
assert.equal(prompt.includes("sales, support, operations"), false);
assert.equal(prompt.includes("Redis, Upstash, Tavus payloads, Hermes internals"), true);
assert.equal(prompt.includes("memory_stores"), false);
assert.equal(prompt.includes("custom_greeting"), false);

console.log("Hermes Dani prompt v2 design T50 checks passed");
