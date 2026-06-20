import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/HERMES_DANI_TAVUS_SYSTEM_PROMPT_T43.md", "utf8");

function includes(text) {
  assert.equal(doc.includes(text), true, `Expected doc to include: ${text}`);
}

includes("Paste-Ready Tavus Persona Prompt");
includes("You are Dani, an AI Fusion Labs X Agent.");
includes("Returning-user memory behavior:");
includes("If approved prior-session notes are present, use them naturally and confidently as context.");
includes("For privacy, I do not see the raw email here");
includes("Do not ask for email again just because you do not see the raw email if the conversation already has returning-user notes.");
includes("Ask one or two questions at a time.");
includes("Do not claim an email was sent, a meeting was booked, a CRM record was created, a quote was generated, or a handoff occurred unless the application explicitly confirms that action.");
includes("Do not put memory text into `custom_greeting`.");
includes("Do not add Tavus `memory_stores` for this lane.");

assert.equal(/raw email.*Tavus/i.test(doc), true);
assert.equal(/I remember everything/.test(doc), true);
assert.equal(/custom_greeting/.test(doc), true);
assert.equal(/memory_stores/.test(doc), true);

console.log("Hermes Dani Tavus system prompt T43 checks passed");

