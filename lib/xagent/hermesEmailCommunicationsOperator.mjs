import { createHash } from "crypto";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const OPERATOR_VERSION = "t46_hermes_email_communications_operator_v1";
const ENABLED_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_KILL_SWITCH";
const MODE_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_MODE";
const PROVIDER_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_PROVIDER";
const ADMIN_RECIPIENT_ENV = "XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT";
const CALENDLY_URL_ENV = "XAGENT_AI_FUSION_CALENDLY_URL";
const DRAFT_ONLY_MODE = "draft_only";
const SEND_MODE = "send";
const PROVIDER_NONE = "none";
const PROVIDER_RESEND = "resend";
const PROVIDER_AGENTMAIL = "agentmail";
const AGENT_DISPLAY_NAME = "Dani";
const CALENDLY_MEETING_LABEL = `${AGENT_DISPLAY_NAME} Demo Call`;
const CALENDLY_MEETING_LENGTH = "30-minute";
const CALENDLY_TIMEZONE = "Phoenix, AZ";
const CALENDLY_EVENT_URL_ENV = "XAGENT_AI_FUSION_CALENDLY_EVENT_URL";
const MAX_EMAIL_BODY_LENGTH = 2400;
const DISALLOWED_VISITOR_NAME_WORDS = new Set([
  "back",
  "calling",
  "checking",
  "following",
  "hoping",
  "interested",
  "looking",
  "returning",
  "sorry",
  "to",
  "trying",
  "wondering",
]);

function env(key, source = process.env) {
  return source[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function nowIso(now = new Date()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isNaN(value.valueOf()) ? new Date(0).toISOString() : value.toISOString();
}

function truncate(value, maxLength) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function truncateMultiline(value, maxLength) {
  const clean = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function readGateConfig(overrides = {}) {
  return {
    enabled: env(ENABLED_ENV, overrides),
    daniPilotEnabled: env(DANI_PILOT_ENV, overrides),
    killSwitch: env(KILL_SWITCH_ENV, overrides),
  };
}

export function areHermesEmailActionGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function readHermesEmailActionMode(overrides = {}) {
  const mode = (env(MODE_ENV, overrides) || DRAFT_ONLY_MODE).toLowerCase();
  if (mode !== DRAFT_ONLY_MODE && mode !== SEND_MODE) {
    throw new Error(`${MODE_ENV} must be draft_only or send`);
  }
  return mode;
}

export function readHermesEmailActionProvider(overrides = {}) {
  const provider = (env(PROVIDER_ENV, overrides) || PROVIDER_NONE).toLowerCase();
  if (![PROVIDER_NONE, PROVIDER_RESEND, PROVIDER_AGENTMAIL].includes(provider)) {
    throw new Error(`${PROVIDER_ENV} must be none, resend, or agentmail`);
  }
  return provider;
}

function readCalendlyUrl(overrides = {}) {
  const value = env(CALENDLY_EVENT_URL_ENV, overrides) || env(CALENDLY_URL_ENV, overrides);
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function isHermesEmailCalendlyCtaConfigured(overrides = {}) {
  return Boolean(readCalendlyUrl(overrides));
}

function redactEmailLikeText(content) {
  return String(content ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:[a-z0-9]\s*[- ]\s*){2,}[a-z0-9]?\s*(?:at|@)\s*(?:gmail|yahoo|outlook|hotmail)(?:\s*dot\s*|\.)\s*[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b[a-z0-9._%+-]+\s+(?:at)\s+[a-z0-9.-]+(?:\s+dot\s+|\.)[a-z]{2,}\b/gi, "[email redacted]");
}

function collectTranscriptSignals(transcript) {
  const normalized = normalizeTranscriptTurns(transcript);
  const safeUserTurns = normalized
    .filter((turn) => turn.role === "user")
    .map((turn) => redactEmailLikeText(turn.content))
    .filter((content) => content.length >= 12);
  return {
    normalized_turn_count: normalized.length,
    user_turn_count: safeUserTurns.length,
    safe_user_signal_preview: truncate(safeUserTurns.slice(0, 4).join(" "), 420),
  };
}

function stripTrailingPunctuation(value) {
  return String(value ?? "")
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .trim()
    .replace(/\ba\.m$/i, "a.m.")
    .replace(/\bp\.m$/i, "p.m.");
}

function cleanMeetingTime(value) {
  return stripTrailingPunctuation(value)
    .replace(/\s+/g, " ")
    .replace(/\bnext week\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, "next week $1")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s*/i, "$1 at ")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(ten|eleven|twelve|one|two|three|four|five|six|seven|eight|nine|\d{1,2})\b/i, "$1 at $2")
    .replace(/\bten\s+am\b/i, "10 a.m.")
    .replace(/\bten\s+pm\b/i, "10 p.m.")
    .replace(/\ba\.?m\.?/gi, "a.m.")
    .replace(/\bp\.?m\.?/gi, "p.m.")
    .replace(/\ba\.m\.\./gi, "a.m.")
    .replace(/\bp\.m\.\./gi, "p.m.");
}

const MEETING_TIME_PATTERNS = [
  /\b(?:next\s+week\s+|next\s+)?(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+(?:morning|afternoon|evening\s+)?(?:around\s+|about\s+)?(?:at\s+)?(?:ten|eleven|twelve|one|two|three|four|five|six|seven|eight|nine|\d{1,2})(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|in\s+the\s+morning|in\s+the\s+afternoon)?(?:\s+(?:phoenix(?:\s+time)?|arizona(?:\s+time)?|mst|mountain\s+time))?/i,
  /\b(?:ten|eleven|twelve|one|two|three|four|five|six|seven|eight|nine|\d{1,2})(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm)(?:\s+(?:phoenix(?:\s+time)?|arizona(?:\s+time)?|mst|mountain\s+time))?\s+(?:on\s+)?(?:next\s+week\s+|next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(?:next\s+week\s+|next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:morning|afternoon|evening)\b/i,
  /\b(?:next\s+week\s+|next\s+)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

const COMPANY_PATTERNS = [
  /\b(?:run|own|operate)\s+([A-Z][A-Za-z0-9&.' -]{2,80}?(?:Law Firm|Soccer|LLC|Inc|Agency|Group|Clinic|Dental|Roofing|Plumbing|Store|Company))\b/i,
  /\b(?:company|business)(?:\s+name)?\s+(?:is|called)\s+([A-Z][A-Za-z0-9&.' -]{2,80}?(?:Law Firm|Soccer|LLC|Inc|Agency|Group|Clinic|Dental|Roofing|Plumbing|Store|Company))\b/i,
  /\b([A-Z][A-Za-z0-9&.' -]{2,80}\s+(?:Law Firm|Soccer|LLC|Inc|Agency|Group|Clinic|Dental|Roofing|Plumbing|Store|Company))\b/,
];

const FOCUS_PATTERNS = [
  /\b(legal intake)\b/i,
  /\b(client intake)\b/i,
  /\b(intake)\b/i,
  /\b(scheduling)\b/i,
  /\b(calendar integration)\b/i,
  /\b(CRM linking)\b/i,
];

function normalizeVisitorNameCandidate(value) {
  const name = stripTrailingPunctuation(value)
    .replace(/[^A-Za-z' -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  if (DISALLOWED_VISITOR_NAME_WORDS.has(lower)) return null;
  if (lower.split(/\s+/).some((part) => DISALLOWED_VISITOR_NAME_WORDS.has(part))) return null;
  if (!/^[A-Za-z][A-Za-z' -]{1,40}$/.test(name)) return null;
  return name
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function pickVisitorName(userTurns) {
  const patterns = [
    /\bmy name(?:'s| is)\s+([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30})?)\b/i,
    /\bthis is\s+([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30})?)\b/i,
    /\bit'?s\s+([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30})?)\b/i,
    /\bi'?m\s+([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30})?)\b/i,
  ];

  for (const value of userTurns) {
    for (const pattern of patterns) {
      const match = value.match(pattern);
      const name = normalizeVisitorNameCandidate(match?.[1]);
      if (name) return name;
    }
  }
  return "there";
}

function pickFirstMatch(values, patterns, fallback = null) {
  for (const value of values) {
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match?.[1]) return stripTrailingPunctuation(match[1]);
      if (match?.[0]) return stripTrailingPunctuation(match[0]);
    }
  }
  return fallback;
}

function safePriorMemoryText(priorMemoryRecord) {
  if (!priorMemoryRecord || typeof priorMemoryRecord !== "object") return "";
  if (typeof priorMemoryRecord.recalled_memory_summary !== "string") return "";
  return redactEmailLikeText(priorMemoryRecord.recalled_memory_summary);
}

function collectEmailInsights(transcript, priorMemoryRecord = null) {
  const normalized = normalizeTranscriptTurns(transcript);
  const userTurns = normalized
    .filter((turn) => turn.role === "user")
    .map((turn) => redactEmailLikeText(turn.content))
    .filter(Boolean);
  const agentTurns = normalized
    .filter((turn) => turn.role === "agent")
    .map((turn) => redactEmailLikeText(turn.content))
    .filter(Boolean);
  const combined = [...userTurns, ...agentTurns];
  const combinedText = combined.join(" ");
  const priorMemorySummary = safePriorMemoryText(priorMemoryRecord);
  const priorMemoryValues = priorMemorySummary ? [priorMemorySummary] : [];

  const visitorName = pickVisitorName(userTurns);
  const company = pickFirstMatch(combined, COMPANY_PATTERNS, null)
    ?? pickFirstMatch(priorMemoryValues, COMPANY_PATTERNS, null);
  const currentMeetingTimeCandidate = pickFirstMatch([combinedText, ...combined], MEETING_TIME_PATTERNS, null);
  const priorMeetingTimeCandidate = currentMeetingTimeCandidate
    ? null
    : pickFirstMatch(priorMemoryValues, MEETING_TIME_PATTERNS, null);
  const meetingTimeCandidate = currentMeetingTimeCandidate ?? priorMeetingTimeCandidate;
  const meetingTime = meetingTimeCandidate ? cleanMeetingTime(meetingTimeCandidate) : null;
  const focus = pickFirstMatch(combined, FOCUS_PATTERNS, null)
    ?? pickFirstMatch(priorMemoryValues, FOCUS_PATTERNS, null)
    ?? (company?.toLowerCase().includes("law firm") ? "legal intake" : "X Agent workflow follow-up");
  const sendOrInviteRequested = [...combined, ...priorMemoryValues]
    .some((turn) => /\b(?:send|sent|confirm|confirmation|requested).{0,50}(?:email|invitation|invite|meeting)\b/i.test(turn));
  const requestedAction = sendOrInviteRequested
    ? "Send or confirm the meeting invitation email"
    : "Review the session and follow up with the visitor";
  const meetingRequested = [...combined, ...priorMemoryValues].some((turn) => (
    /\b(?:meeting|demo|call|appointment|calendar|calendly|schedule|scheduled|scheduling|book|booking|invitation|invite)\b/i
      .test(turn)
  )) || Boolean(meetingTime);
  const leadScore = Math.min(
    10,
    3
      + (company ? 1 : 0)
      + (meetingRequested ? 2 : 0)
      + (meetingTime ? 1 : 0)
      + (focus && focus !== "X Agent workflow follow-up" ? 1 : 0)
      + (combined.some((turn) => /\b(?:remember me|notes from|last conversation|earlier chats|calling back|follow up)\b/i.test(turn)) ? 2 : 0),
  );

  return {
    visitorName,
    company,
    meetingTime,
    meetingTimeSource: currentMeetingTimeCandidate ? "current_transcript" : (priorMeetingTimeCandidate ? "prior_memory" : null),
    focus,
    requestedAction,
    meetingRequested,
    returningVisitor: combined.some((turn) => /\b(?:remember me|notes from|last conversation|earlier chats|calling back|follow up)\b/i.test(turn)),
    priorMemoryUsedForEmailContext: Boolean(priorMemorySummary),
    leadScore,
    userTurnCount: userTurns.length,
    agentTurnCount: agentTurns.length,
  };
}

function bullet(lines) {
  return lines
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlParagraph(line) {
  const linked = escapeHtml(line).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1d4ed8;text-decoration:underline;">$1</a>',
  );
  return `<p style="margin:0 0 14px 0;line-height:1.55;">${linked}</p>`;
}

function buildEmailHtmlPreview(bodyText) {
  const headings = new Set([
    "Discussion Summary",
    "Schedule / Confirmation",
    "Schedule a Time",
    "Contact / Context",
    "Request Details",
    "Scheduling / Follow-up",
    "Operator Action Plan",
    "Contact / Account",
    "Opportunity Signals",
    "Recommended Next Steps",
  ]);
  const sections = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      sections.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of String(bodyText ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    if (headings.has(line)) {
      closeList();
      sections.push(`<h2 style="font-size:16px;line-height:1.3;margin:24px 0 10px;color:#111827;">${escapeHtml(line)}</h2>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!listOpen) {
        sections.push('<ul style="margin:0 0 16px 20px;padding:0;line-height:1.55;">');
        listOpen = true;
      }
      sections.push(`<li style="margin:0 0 6px 0;">${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    sections.push(htmlParagraph(line));
  }
  closeList();

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;max-width:680px;">',
    ...sections,
    "</div>",
  ].join("");
}

function buildCalendlyCta({ calendlyUrl, meetingRequested }, insights = {}) {
  if (!calendlyUrl) return "";
  let schedulingUrl = calendlyUrl;
  try {
    const parsed = new URL(calendlyUrl);
    parsed.searchParams.set("utm_source", "xagent");
    parsed.searchParams.set("utm_medium", "email");
    parsed.searchParams.set("utm_campaign", "dani_followup");
    if (insights.visitorName && insights.visitorName !== "there") {
      parsed.searchParams.set("name", insights.visitorName);
    }
    if (insights.meetingTime) {
      parsed.searchParams.set("a1", `Requested meeting time: ${insights.meetingTime}`);
    }
    if (insights.requestedAction) {
      parsed.searchParams.set("a2", `Requested next step: ${insights.requestedAction}`);
    }
    schedulingUrl = parsed.toString();
  } catch {
    schedulingUrl = calendlyUrl;
  }
  if (meetingRequested && insights.meetingTime) {
    const meetingTimeIntro = insights.meetingTimeSource === "prior_memory"
      ? `Prior conversation notes mention this meeting time: ${insights.meetingTime}`
      : `You mentioned this meeting time: ${insights.meetingTime}`;
    return [
      meetingTimeIntro,
      `Use this meeting-specific link to choose or confirm the closest available ${CALENDLY_MEETING_LENGTH} ${CALENDLY_MEETING_LABEL}: ${schedulingUrl}`,
      "If that exact time is not open, the AI Fusion Labs team can coordinate the closest available option.",
    ].join("\n");
  }
  if (meetingRequested) {
    return `Use this link to choose a ${CALENDLY_MEETING_LENGTH} ${CALENDLY_MEETING_LABEL}: ${schedulingUrl}`;
  }
  return `If a deeper walkthrough would be helpful, you can book a ${CALENDLY_MEETING_LENGTH} ${CALENDLY_MEETING_LABEL} here: ${schedulingUrl}`;
}

function buildVisitorFollowupEmail(insights, schedulingContext) {
  const greetingName = insights.visitorName && insights.visitorName !== "there" ? ` ${insights.visitorName}` : "";
  const calendlyCta = buildCalendlyCta(schedulingContext, insights);
  const schedulingHeading = insights.meetingTime ? "Schedule / Confirmation" : "Schedule a Time";
  const meetingTimeDisplay = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior conversation notes)" : ""}`
    : "not specified";
  return [
    `Hi${greetingName},`,
    "",
    insights.meetingTimeSource === "prior_memory"
      ? "Thank you for speaking with Dani again. We connected this session to your prior Dani notes and prepared the next step for review."
      : insights.meetingTime
      ? "Thank you for speaking with Dani. We captured your follow-up request and the meeting time you mentioned."
      : "Thank you for spending time with Dani. We captured your request and prepared the next step for review.",
    "",
    "Discussion Summary",
    bullet([
      insights.company ? `Business/context: ${insights.company}` : null,
      `Requested next step: ${insights.requestedAction}`,
      `Requested meeting time: ${meetingTimeDisplay}`,
      `Primary topic: ${insights.focus}`,
    ]),
    calendlyCta ? "" : null,
    calendlyCta ? schedulingHeading : null,
    calendlyCta || null,
    "",
    insights.meetingTime
      ? "We will not claim the meeting is scheduled until the booking is confirmed, but this gives the team the exact time window you asked about."
      : "If you have already chosen a time, no extra action is needed. Otherwise, the AI Fusion Labs team will review the request and follow up with the appropriate details.",
    "",
    "Best regards,",
    AGENT_DISPLAY_NAME,
  ].filter((line) => line !== null).join("\n");
}

function buildAdminSummaryEmail(insights, providerConversationId, transcriptSignals, schedulingContext) {
  const meetingTimeDisplay = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior conversation notes)" : ""}`
    : "not specified";
  return [
    "New Dani Intake",
    "",
    `Conversation ID: ${providerConversationId}`,
    "",
    "Contact / Context",
    bullet([
      insights.visitorName ? `Visitor name heard: ${insights.visitorName}` : null,
      insights.company ? `Business/context: ${insights.company}` : null,
      `Email/contact status: captured by the website memory flow when supplied`,
      insights.priorMemoryUsedForEmailContext ? "Prior memory context consulted for missing email details: yes" : null,
    ]),
    "",
    "Request Details",
    bullet([
      `Requested action: ${insights.requestedAction}`,
      `Requested meeting time: ${meetingTimeDisplay}`,
      `Primary workflow: ${insights.focus}`,
      `Calendly CTA included: ${schedulingContext.calendlyCtaIncluded ? "yes" : "no"}`,
      `Visitor-facing CTA references requested time: ${schedulingContext.calendlyCtaIncluded && insights.meetingTime ? "yes" : "no"}`,
      schedulingContext.calendlyCtaIncluded
        ? `Calendly CTA reason: ${insights.meetingRequested ? "visitor requested a meeting/demo" : "soft scheduling option included"}`
        : "Calendly CTA reason: booking link not configured",
      `Transcript turns retained for planning: ${transcriptSignals.normalized_turn_count}`,
    ]),
    "",
    "Scheduling / Follow-up",
    bullet([
      insights.meetingTime
        ? `Prioritize confirming the requested ${insights.meetingTime} meeting window.`
        : "No specific meeting time was detected.",
      "Do not tell the visitor a meeting is scheduled until Calendly or a human confirms the booking.",
      "If the exact requested time is unavailable, offer the closest available option.",
    ]),
    "",
    "Operator Action Plan",
    bullet([
      "Review the transcript and confirm whether a meeting invite or direct follow-up is needed.",
      "Watch for a Calendly booking before claiming anything is scheduled.",
      "If the visitor requested a specific time, confirm availability before sending a calendar commitment.",
    ]),
  ].join("\n");
}

function buildLeadIntelEmail(insights, transcriptSignals, schedulingContext) {
  const schedulingIntent = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior conversation notes)" : ""}`
    : "not specified";
  return [
    "Dani Lead Intelligence Report",
    "",
    `Prospect Score: ${insights.leadScore}/10`,
    "",
    "Contact / Account",
    bullet([
      `Lead temperature: ${insights.returningVisitor ? "returning warm lead" : "new/unknown lead"}`,
      insights.company ? `Account context: ${insights.company}` : null,
      insights.visitorName ? `Visitor name heard: ${insights.visitorName}` : null,
    ]),
    "",
    "Opportunity Signals",
    bullet([
      `Intent signal: ${insights.requestedAction}`,
      `Workflow interest: ${insights.focus}`,
      `Scheduling intent: ${schedulingIntent}`,
      `Calendly CTA included: ${schedulingContext.calendlyCtaIncluded ? "yes" : "no"}`,
      `User turns captured: ${transcriptSignals.user_turn_count}`,
    ]),
    "",
    "Recommended Next Steps",
    bullet([
      insights.meetingTime
        ? `Prioritize the requested ${insights.meetingTime} meeting window in the operator follow-up.`
        : "Send a concise confirmation using the user-facing follow-up.",
      "Prepare the meeting around the requested workflow and known context.",
      "Avoid claiming any calendar invite or external system update occurred until the tool confirms it.",
    ]),
  ].join("\n");
}

function buildActionId(providerConversationId, actionType) {
  return `hxemail_${sha256(`${OPERATOR_VERSION}:${providerConversationId}:${actionType}`).slice(0, 16)}`;
}

function buildDraftAction({
  actionType,
  providerConversationId,
  subject,
  bodyText,
  recipientPolicy,
  providerCandidate,
}) {
  const safeBodyText = truncateMultiline(redactEmailLikeText(bodyText), MAX_EMAIL_BODY_LENGTH);
  return {
    action_id: buildActionId(providerConversationId, actionType),
    action_type: actionType,
    status: "draft_ready_send_blocked",
    draft_created: true,
    send_attempted: false,
    send_completed: false,
    provider_candidate: providerCandidate,
    recipient_policy: recipientPolicy,
    subject_preview: truncate(subject, 140),
    body_text_preview: safeBodyText,
    body_html_preview: buildEmailHtmlPreview(safeBodyText),
    operator_review_required_before_send: true,
    action_claim_allowed: false,
    send_blocked_reason: "live_email_send_not_enabled",
  };
}

function preferredProvider(provider) {
  if (provider === PROVIDER_AGENTMAIL) return PROVIDER_AGENTMAIL;
  if (provider === PROVIDER_RESEND) return PROVIDER_RESEND;
  return PROVIDER_NONE;
}

export function buildHermesEmailCommunicationPlan({
  provider_conversation_id,
  transcript,
  transcriptMetadata,
  memoryOperatorResult,
  priorMemoryRecord,
} = {}, options = {}) {
  const providerConversationId = typeof provider_conversation_id === "string"
    ? provider_conversation_id.trim()
    : "";
  if (!providerConversationId) {
    throw new Error("provider_conversation_id is required");
  }

  const envSource = options.env ?? process.env;
  const provider = readHermesEmailActionProvider(envSource);
  const providerCandidate = preferredProvider(provider);
  const transcriptSignals = collectTranscriptSignals(transcript);
  const emailInsights = collectEmailInsights(transcript, priorMemoryRecord);
  const calendlyUrl = readCalendlyUrl(envSource);
  const schedulingContext = {
    calendlyConfigured: Boolean(calendlyUrl),
    calendlyUrl,
    calendlyCtaIncluded: Boolean(calendlyUrl),
    meetingRequested: emailInsights.meetingRequested,
    calendlyMeetingLabel: CALENDLY_MEETING_LABEL,
    calendlyMeetingLength: CALENDLY_MEETING_LENGTH,
    calendlyTimezone: CALENDLY_TIMEZONE,
  };
  const createdAt = nowIso(options.now);
  const adminRecipientPolicy = options.adminRecipientConfigured || Boolean(env(ADMIN_RECIPIENT_ENV, envSource))
    ? "configured_internal_recipient_redacted"
    : "internal_recipient_not_configured";
  const userRecipientPolicy = "typed_check_in_email_only";

  const userFollowup = buildDraftAction({
    actionType: "email.user_followup",
    providerConversationId,
    providerCandidate,
    recipientPolicy: userRecipientPolicy,
    subject: `Dani follow-up: ${emailInsights.meetingTime ?? "requested"} follow-up`,
    bodyText: buildVisitorFollowupEmail(emailInsights, schedulingContext),
  });

  const adminSummary = buildDraftAction({
    actionType: "email.admin_summary",
    providerConversationId,
    providerCandidate,
    recipientPolicy: adminRecipientPolicy,
    subject: `Dani session: ${emailInsights.requestedAction}`,
    bodyText: buildAdminSummaryEmail(emailInsights, providerConversationId, transcriptSignals, schedulingContext),
  });

  const leadIntel = buildDraftAction({
    actionType: "email.lead_intel",
    providerConversationId,
    providerCandidate,
    recipientPolicy: adminRecipientPolicy,
    subject: `[PROSPECT SCORE ${emailInsights.leadScore}/10] Lead intel: ${emailInsights.company ?? "Dani returning visitor"}`,
    bodyText: buildLeadIntelEmail(emailInsights, transcriptSignals, schedulingContext),
  });

  return {
    operator_version: OPERATOR_VERSION,
    artifact_purpose: "xagent_hermes_email_communications_plan",
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    created_at: createdAt,
    communication_plan_id: `hxecp_${sha256(`${OPERATOR_VERSION}:${providerConversationId}:${createdAt}`).slice(0, 16)}`,
    mode: DRAFT_ONLY_MODE,
    configured_provider: provider,
    provider_recommendation: {
      first_controlled_live_send: PROVIDER_RESEND,
      replyable_agent_inbox: PROVIDER_AGENTMAIL,
      suggested_agentmail_username: "dani-xagent",
      suggested_agentmail_display_name: "Dani X Agent SDR",
    },
    transcript_metadata: transcriptMetadata ?? {},
    transcript_signal_metadata: transcriptSignals,
    email_insight_metadata: {
      returning_visitor_signal: emailInsights.returningVisitor,
      company_detected: Boolean(emailInsights.company),
      meeting_time_detected: Boolean(emailInsights.meetingTime),
      meeting_time_source: emailInsights.meetingTimeSource,
      focus_detected: Boolean(emailInsights.focus),
      meeting_request_detected: Boolean(emailInsights.meetingRequested),
      prior_memory_used_for_email_context: Boolean(emailInsights.priorMemoryUsedForEmailContext),
      calendly_cta_included: schedulingContext.calendlyCtaIncluded,
      calendly_meeting_label: schedulingContext.calendlyMeetingLabel,
      calendly_meeting_length: schedulingContext.calendlyMeetingLength,
      calendly_timezone: schedulingContext.calendlyTimezone,
      lead_score: emailInsights.leadScore,
    },
    memory_record_id: memoryOperatorResult?.memory_record_id ?? null,
    memory_record_stored: Boolean(memoryOperatorResult?.memory_record_stored),
    action_count: 3,
    draft_count: 3,
    send_count: 0,
    actions: [userFollowup, adminSummary, leadIntel],
    policies: {
      post_session_only: true,
      live_turn_loop_dependency: false,
      outbound_action_allowed: false,
      outbound_completion_claim_allowed_without_tool_confirmation: false,
      raw_email_available_to_email_action_layer: false,
      raw_transcript_stored_in_plan: false,
      operator_review_required_before_send: true,
    },
    agentmail_inbox_created: false,
    resend_called: false,
    agentmail_called: false,
    live_agentmail_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
  };
}

export async function runHermesEmailCommunicationsOperator(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  if (!areHermesEmailActionGatesOpen(envSource)) {
    return {
      hermes_email_actions_attempted: false,
      hermes_email_actions_planned: false,
      hermes_email_actions_status: "email_actions_disabled",
      hermes_email_actions_mode: readHermesEmailActionMode(envSource),
      hermes_email_actions_provider: readHermesEmailActionProvider(envSource),
      action_count: 0,
      draft_count: 0,
      send_count: 0,
      agentmail_inbox_created: false,
      resend_called: false,
      agentmail_called: false,
      live_agentmail_called: false,
      live_hermes_called: false,
      openai_called: false,
      ollama_generate_called: false,
      outbound_action_taken: false,
      production_database_mutated: false,
    };
  }

  const mode = readHermesEmailActionMode(envSource);
  const provider = readHermesEmailActionProvider(envSource);
  if (mode === SEND_MODE) {
    return {
      hermes_email_actions_attempted: true,
      hermes_email_actions_planned: false,
      hermes_email_actions_status: "send_mode_blocked_until_provider_adapter_approved",
      hermes_email_actions_mode: mode,
      hermes_email_actions_provider: provider,
      action_count: 0,
      draft_count: 0,
      send_count: 0,
      agentmail_inbox_created: false,
      resend_called: false,
      agentmail_called: false,
      live_agentmail_called: false,
      live_hermes_called: false,
      openai_called: false,
      ollama_generate_called: false,
      outbound_action_taken: false,
      production_database_mutated: false,
    };
  }

  const plan = buildHermesEmailCommunicationPlan(input, options);
  return {
    hermes_email_actions_attempted: true,
    hermes_email_actions_planned: true,
    hermes_email_actions_status: "draft_plan_created",
    hermes_email_actions_mode: mode,
    hermes_email_actions_provider: provider,
    communication_plan_id: plan.communication_plan_id,
    action_count: plan.action_count,
    draft_count: plan.draft_count,
    send_count: plan.send_count,
    provider_recommendation: plan.provider_recommendation,
    actions: plan.actions,
    action_claim_allowed: false,
    operator_review_required_before_send: true,
    agentmail_inbox_created: false,
    resend_called: false,
    agentmail_called: false,
    live_agentmail_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
  };
}

export const HERMES_EMAIL_COMMUNICATIONS_OPERATOR_VERSION = OPERATOR_VERSION;
