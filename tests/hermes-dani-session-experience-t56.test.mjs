import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertNoUnsafeSessionExperienceValue,
  buildDaniLiveNotesState,
  buildDaniPostSessionResultsState,
} from "../lib/xagent/daniSessionExperience.mjs";

function assertNoLeak(value) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "rob@example.com",
    "rvicks@gmail.com",
    "summary_hash",
    "record_hash",
    "xagents/",
    "visitor_",
    "xagent_session_",
    "conversation_url",
    "tavus.daily.co",
    "api_key",
    "transcript",
    "prompt text",
  ];

  for (const token of forbidden) {
    assert.equal(serialized.toLowerCase().includes(token.toLowerCase()), false, `leaked ${token}`);
  }

  assert.equal(assertNoUnsafeSessionExperienceValue(value), true);
}

const emptyNotes = buildDaniLiveNotesState({});
assert.equal(emptyNotes.title, "Dani's Notes");
assert.equal(emptyNotes.visitorLabel, "Visitor");
assert.match(JSON.stringify(emptyNotes), /Fresh session/);
assert.match(JSON.stringify(emptyNotes), /Listening for business context/);
assert.match(JSON.stringify(emptyNotes), /Dani will capture the next clear next step/);
assertNoLeak(emptyNotes);

const populatedNotes = buildDaniLiveNotesState({
  displayName: "Rob",
  memoryCheckInSupplied: true,
  conversationStart: {
    memory_context_requested: true,
    memory_context_applied: true,
    tavus_conversational_context_attached: true,
  },
});
assert.equal(populatedNotes.visitorLabel, "Rob");
assert.match(JSON.stringify(populatedNotes), /Approved prior notes are active/);
assert.match(JSON.stringify(populatedNotes), /Continuing from approved prior notes/);
assert.match(JSON.stringify(populatedNotes), /Website check-in identity/);
assert.match(JSON.stringify(populatedNotes), /Memory on/);
assertNoLeak(populatedNotes);

const emailAsName = buildDaniLiveNotesState({
  displayName: "rob@example.com",
  memoryCheckInSupplied: true,
});
assert.equal(emailAsName.visitorLabel, "Visitor");
assertNoLeak(emailAsName);

const pendingResults = buildDaniPostSessionResultsState({
  memoryContextApplied: true,
  endedAtLabel: "Jun 23, 11:30 AM",
});
assert.equal(pendingResults.title, "Thank you for speaking with Dani");
assert.match(JSON.stringify(pendingResults), /Session handoff is queued/);
assert.match(JSON.stringify(pendingResults), /Follow-up request captured/);
assert.match(JSON.stringify(pendingResults), /Memory used this session/);
assert.match(JSON.stringify(pendingResults), /Use the same email next time/);
assertNoLeak(pendingResults);

const confirmedResults = buildDaniPostSessionResultsState({
  memoryContextApplied: true,
  emailActionStatus: {
    email_action_status_available: true,
    email_action_plan_created: true,
    action_count: 3,
    draft_count: 3,
    send_count: 3,
    action_types: ["email.user_followup", "email.admin_summary", "email.lead_intel"],
    memory_record_stored: true,
    action_claim_allowed: true,
    agentmail_message_sent: true,
  },
  endedAtLabel: "Jun 23, 11:35 AM",
});
assert.match(JSON.stringify(confirmedResults), /Follow-up email sent/);
assert.match(JSON.stringify(confirmedResults), /Admin summary sent/);
assert.match(JSON.stringify(confirmedResults), /Memory ready/);
assert.match(JSON.stringify(confirmedResults), /Confirmed by backend action status/);
assertNoLeak(confirmedResults);

const livePanelSource = await readFile("components/dani/DaniLiveNotesPanel.tsx", "utf8");
assert.match(livePanelSource, /buildDaniLiveNotesState/);
assert.match(livePanelSource, /notes\.title/);
assert.match(livePanelSource, /w-\[min\(92vw,390px\)\]/);
assert.match(livePanelSource, /max-h-\[calc\(100vh-150px\)\]/);
assert.match(livePanelSource, /aria-expanded/);
assert.equal(livePanelSource.includes("email"), false, "live panel source should not render raw email fields");

const resultsSource = await readFile("components/dani/DaniPostSessionResults.tsx", "utf8");
assert.match(resultsSource, /buildDaniPostSessionResultsState/);
assert.match(resultsSource, /Dani session complete/);
assert.match(resultsSource, /Confirmation Boundary/);
assert.match(resultsSource, /sm:grid-cols-2/);
assert.match(resultsSource, /lg:grid-cols-4/);
assert.equal(resultsSource.includes("provider_conversation_id"), false);

const playerSource = await readFile("components/TavusPlayer.tsx", "utf8");
assert.match(playerSource, /DaniLiveNotesPanel/);
assert.match(playerSource, /DaniPostSessionResults/);
assert.match(playerSource, /api\/xagent\/email-actions\/status/);
assert.match(playerSource, /finishSession/);
assert.match(playerSource, /safe_status_only/);
assert.equal(playerSource.includes("conversation_url_present"), false);

console.log("Hermes Dani session experience T56 checks passed");
