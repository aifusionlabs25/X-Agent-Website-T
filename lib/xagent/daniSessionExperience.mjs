const CALENDLY_FALLBACK_URL = "https://calendly.com/aifusionlabs";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const BACKEND_TOKEN_PATTERNS = [
  /\bhx[a-z]+_[a-z0-9]+\b/i,
  /\bxagents\//i,
  /\b(?:visitor|xagent_session)_[a-f0-9-]{8,}\b/i,
  /\bsummary_hash\b/i,
  /\brecord_hash\b/i,
  /\bnamespace\b/i,
  /\b(?:raw_transcript|transcript_turns?|transcript_content|transcript_text)\b/i,
  /\bmessages\b/i,
  /\bapi[_-]?key\b/i,
  /\bconversation_url\b/i,
  /\btavus\.daily\.co\b/i,
];

function cleanText(value, fallback = "Not available yet") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || EMAIL_PATTERN.test(text) || BACKEND_TOKEN_PATTERNS.some((pattern) => pattern.test(text))) {
    return fallback;
  }
  return text.replace(/\s+/g, " ").slice(0, 140);
}

function bool(value) {
  return value === true;
}

export function pickSafeConversationStartExperienceFlags(response = {}) {
  return {
    memoryRequested: bool(response.memory_context_requested),
    memoryApplied: bool(response.memory_context_applied),
    contextAttached: bool(response.tavus_conversational_context_attached),
  };
}

function statusTone(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  return "neutral";
}

export function assertNoUnsafeSessionExperienceValue(value) {
  const serialized = JSON.stringify(value);
  if (EMAIL_PATTERN.test(serialized)) {
    throw new Error("Dani session experience must not expose raw email addresses");
  }
  for (const pattern of BACKEND_TOKEN_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error("Dani session experience must not expose backend, transcript, prompt, or room data");
    }
  }
  return true;
}

export function buildDaniLiveNotesState(input = {}) {
  const conversationStart = input.conversationStart ?? {};
  const memoryRequested = bool(conversationStart.memoryRequested ?? conversationStart.memory_context_requested)
    || Boolean(input.memoryCheckInSupplied);
  const memoryApplied = bool(conversationStart.memoryApplied ?? conversationStart.memory_context_applied);
  const freshSession = bool(input.freshSession);
  const sessionConnected = bool(input.sessionConnected);
  const visitorLabel = cleanText(input.displayName, "Visitor");

  const memoryStatus = memoryApplied
    ? "Approved prior notes are ready"
    : memoryRequested && !freshSession
      ? "Memory check-in received"
      : "Fresh session";

  const handoffChannel = memoryRequested && !freshSession
    ? "Website check-in available"
    : "Not supplied yet";

  const standbyValue = sessionConnected ? "Listening now" : "Waiting for the session to connect";
  const notCapturedValue = sessionConnected ? "Not captured yet" : "Waiting for live conversation details";

  const notes = {
    title: "Dani's Notes",
    subtitle: sessionConnected
      ? "Safe live cues only. Backend details stay hidden."
      : "Ready for live cues once the session connects.",
    visitorLabel,
    statusChips: [
      { label: sessionConnected ? "Notes live" : "Notes standby", status: sessionConnected ? "active" : "neutral" },
      { label: memoryApplied ? "Memory on" : freshSession ? "Fresh start" : "Memory standby", status: memoryApplied ? "confirmed" : "neutral" },
      { label: "Follow-up available", status: "pending" },
    ],
    rows: [
      { label: "Visitor", value: visitorLabel },
      { label: "Memory", value: memoryStatus },
      {
        label: "Business context",
        value: memoryApplied ? "Prior context is available; live details still pending" : standbyValue,
      },
      {
        label: "Current use case",
        value: notCapturedValue,
      },
      {
        label: "Requested next step",
        value: "Not captured yet",
      },
      {
        label: "Meeting or email request",
        value: "Not requested yet",
      },
      { label: "Preferred handoff", value: handoffChannel },
    ],
    openQuestions: [],
    footer: memoryApplied
      ? "Dani can use approved prior notes once connected; completed actions still require backend confirmation."
      : "If you started fresh, Dani will not use prior conversation memory in this session.",
  };

  assertNoUnsafeSessionExperienceValue(notes);
  return notes;
}

function getActionTypes(status) {
  return Array.isArray(status?.action_types) ? status.action_types.filter((item) => typeof item === "string") : [];
}

export function buildDaniPostSessionResultsState(input = {}) {
  const status = input.emailActionStatus ?? {};
  const statusAvailable = bool(status.email_action_status_available);
  const planCreated = bool(status.email_action_plan_created);
  const sendConfirmed = bool(status.action_claim_allowed) && Number(status.send_count ?? 0) > 0;
  const actionTypes = getActionTypes(status);
  const memoryReady = bool(status.memory_record_stored);
  const memoryApplied = bool(input.memoryContextApplied);
  const nowLabel = cleanText(input.endedAtLabel, "Just now");

  const followUpStatus = sendConfirmed
    ? { label: "Follow-up email sent", status: "confirmed", detail: "Confirmed by backend action status." }
    : planCreated
      ? { label: "Follow-up plan prepared", status: "pending", detail: "Awaiting confirmed send status before Dani claims completion." }
      : { label: "Follow-up request captured", status: "pending", detail: "The handoff can be reviewed after session processing." };

  const adminStatus = sendConfirmed && actionTypes.includes("email.admin_summary")
    ? { label: "Admin summary sent", status: "confirmed", detail: "Confirmed by backend action status." }
    : planCreated && actionTypes.includes("email.admin_summary")
      ? { label: "Admin summary prepared", status: "pending", detail: "Operator-facing summary is planned, not claimed as sent." }
      : { label: "Operator review available", status: "pending", detail: "A safe review can be prepared after the session." };

  const memoryStatus = memoryReady
    ? { label: "Memory ready", status: "confirmed", detail: "Approved memory status is available for future visits." }
    : memoryApplied
      ? { label: "Memory used this session", status: "active", detail: "Prior notes helped this session; the new memory update is still pending." }
      : { label: "Memory update pending", status: "pending", detail: "Use the same email next time to continue when memory is available." };

  const result = {
    title: "Thank you for speaking with Dani",
    subtitle: statusAvailable ? "Session status checked safely." : "Session handoff is queued for safe processing.",
    completedAt: nowLabel,
    statusCards: [
      { label: "Session", status: statusAvailable ? "confirmed" : "pending", detail: statusAvailable ? "Processed status is available." : "Processing after the call." },
      followUpStatus,
      adminStatus,
      memoryStatus,
    ].map((card) => ({ ...card, tone: statusTone(card.status) })),
    actions: [
      {
        label: "Schedule a Dani Demo Call",
        href: CALENDLY_FALLBACK_URL,
        external: true,
        available: true,
      },
      {
        label: "Download recap",
        href: "",
        external: false,
        available: false,
        unavailableReason: "Recap download appears only after a safe recap artifact exists.",
      },
    ],
    guidance: "Actions are shown as confirmed only when backend status confirms them. Otherwise, Dani treats them as captured or pending.",
    continuationNote: "Use the same email next time if you want Dani to continue from approved notes.",
    safeStatusOnly: true,
  };

  assertNoUnsafeSessionExperienceValue(result);
  return result;
}

export const DANI_SESSION_EXPERIENCE_VERSION = "t56_dani_session_experience_v1";
