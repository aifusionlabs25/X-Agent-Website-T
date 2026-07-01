import { createHash } from "crypto";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";
import { getXAgentProfile, resolveXAgentSlug } from "./agentProfiles.mjs";
import { DANI_AGENT_SLUG, HAL_AGENT_SLUG, TAVUS_PROVIDER } from "./sessionIdentity.mjs";

const OPERATOR_VERSION = "t46_hermes_email_communications_operator_v1";
const ENABLED_ENV = "XAGENT_HERMES_EMAIL_ACTIONS_ENABLED";
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

function isHalProfile(profile) {
  return profile?.agentSlug === HAL_AGENT_SLUG;
}

function formatMetadataValue(value, fallback = "Not available") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return truncate(String(value), 140);
}

function firstMetadataValue(metadata = {}, keys = []) {
  if (!metadata || typeof metadata !== "object") return "";
  for (const key of keys) {
    const value = metadata[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function formatDurationValue(value) {
  if (value === null || value === undefined || value === "") return "Not available";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return formatMetadataValue(value);
  if (numeric < 60) return `${Math.round(numeric)} seconds`;
  const minutes = Math.floor(numeric / 60);
  const seconds = Math.round(numeric % 60);
  return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
}

function buildSessionDetailRows(providerConversationId, transcriptSignals, transcriptMetadata = {}, generatedAt = "") {
  const startedAt = firstMetadataValue(transcriptMetadata, [
    "conversation_started_at",
    "started_at",
    "start_time",
    "created_at",
    "created",
  ]);
  const endedAt = firstMetadataValue(transcriptMetadata, [
    "conversation_ended_at",
    "ended_at",
    "end_time",
    "completed_at",
    "updated_at",
  ]);
  const duration = firstMetadataValue(transcriptMetadata, [
    "duration_seconds",
    "conversation_duration_seconds",
    "call_duration_seconds",
    "duration",
  ]);
  return [
    { label: "Generated at", value: formatMetadataValue(generatedAt) },
    { label: "Conversation ID", value: providerConversationId },
    { label: "Transcript source", value: formatMetadataValue(transcriptMetadata.transcript_source ?? "Tavus transcription_ready") },
    { label: "Session started", value: formatMetadataValue(startedAt) },
    { label: "Session ended", value: formatMetadataValue(endedAt) },
    { label: "Session duration", value: formatDurationValue(duration) },
    { label: "Transcript turns retained", value: String(transcriptSignals.normalized_turn_count) },
    { label: "User turns captured", value: String(transcriptSignals.user_turn_count) },
  ];
}

function readGateConfig(overrides = {}, options = {}) {
  const profile = getXAgentProfile(options.agentSlug);
  return {
    enabled: env(ENABLED_ENV, overrides),
    agentPilotEnabled: env(profile.hermesEmailActionsPilotEnv, overrides),
    killSwitch: env(KILL_SWITCH_ENV, overrides),
  };
}

export function areHermesEmailActionGatesOpen(overrides = {}, options = {}) {
  const gates = readGateConfig(overrides, options);
  return (
    gates.enabled === "true"
    && gates.agentPilotEnabled === "true"
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

const REQUESTED_MATERIAL_PATTERNS = [
  {
    label: "TLDR recap of the discussion",
    pattern: /\b(?:tldr|tl;dr|recap|summary|summarize|short version)\b/i,
  },
  {
    label: "new client onboarding package if available",
    pattern: /\b(?:onboarding package|client onboarding|new client package|welcome packet|starter packet)\b/i,
  },
  {
    label: "meeting-prep notes for what AI Fusion Labs needs",
    pattern: /\b(?:come prepared|prepare for the meeting|what (?:you|ai fusion labs|the team) need|agenda|meeting agenda)\b/i,
  },
  {
    label: "follow-up email confirmation",
    pattern: /\b(?:follow[-\s]?up email|confirmation email|meeting invitation|invite|send that email)\b/i,
  },
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

function normalizeCompanyCandidate(value) {
  const clean = stripTrailingPunctuation(value);
  if (!clean) return null;
  const organizationPattern =
    /\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,8}\s+(?:Law Firm|Soccer|LLC|Inc|Agency|Group|Clinic|Dental|Roofing|Plumbing|Store|Company))\b/g;
  const matches = [...clean.matchAll(organizationPattern)].map((match) => match[1]);
  return matches.at(-1) ?? clean;
}

function pickCompany(values) {
  return normalizeCompanyCandidate(pickFirstMatch(values, COMPANY_PATTERNS, null));
}

function collectRequestedMaterials(values) {
  const text = values.join(" ");
  const seen = new Set();
  for (const item of REQUESTED_MATERIAL_PATTERNS) {
    if (item.pattern.test(text)) {
      seen.add(item.label);
    }
  }
  return [...seen];
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
  const company = pickCompany(combined) ?? pickCompany(priorMemoryValues);
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
    .some((turn) => (
      /\b(?:send|sent|confirm|confirmation|requested).{0,80}(?:email|invitation|invite|meeting)\b/i.test(turn)
      || /\b(?:include|put|add).{0,50}(?:email|follow[-\s]?up)\b/i.test(turn)
      || /\b(?:email|follow[-\s]?up).{0,50}(?:include|recap|summary|tldr|tl;dr|onboarding)\b/i.test(turn)
    ));
  const requestedAction = sendOrInviteRequested
    ? "Send or confirm the meeting invitation email"
    : "Review the session and follow up with the visitor";
  const meetingRequested = [...combined, ...priorMemoryValues].some((turn) => (
    /\b(?:meeting|demo|call|appointment|calendar|calendly|schedule|scheduled|scheduling|book|booking|invitation|invite)\b/i
      .test(turn)
  )) || Boolean(meetingTime);
  const requestedMaterials = collectRequestedMaterials([...combined, ...priorMemoryValues]);
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
    requestedMaterials,
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

function sentence(value) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
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

function firstUrl(value) {
  return String(value ?? "").match(/https?:\/\/[^\s<)]+/)?.[0] ?? "";
}

function formatEmailValue(value, fallback = "Not specified") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function emailTheme(profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  if (isHalProfile(profile)) {
    return {
      brandLabel: "HAL // EXECUTIVE AUTOPILOT",
      background: "#f2eadc",
      canvas: "#fffaf1",
      canvasAlt: "#f8f1e4",
      border: "#d9c7aa",
      text: "#151411",
      muted: "#5d594f",
      soft: "#efe3cd",
      accent: "#b45f2a",
      accentDark: "#7c351d",
      accentCool: "#234f45",
      headerFallback: "#111417",
      headerBackground: "linear-gradient(135deg,#111417 0%,#172338 54%,#6f321f 100%)",
      eyebrow: "#d8aa64",
      headerText: "#fff9ed",
      headerMuted: "#e7d8c0",
      badgeBg: "#fff4df",
      badgeText: "#151411",
      shadow: "0 22px 54px rgba(31,29,24,.18)",
      darkPanel: "#141a22",
      darkPanelAlt: "#1b2634",
      darkBorder: "#314153",
    };
  }
  return {
    brandLabel: "X Agents",
    background: "#f5f7fb",
    canvas: "#ffffff",
    canvasAlt: "#fbfcff",
    border: "#e8ecf7",
    text: "#111827",
    muted: "#475569",
    soft: "#f7f3ff",
    accent: "#4f46e5",
    accentDark: "#5b21e8",
    accentCool: "#2563eb",
    headerFallback: "#07122f",
    headerBackground: "linear-gradient(135deg,#07122f 0%,#111557 48%,#5b21b6 100%)",
    eyebrow: "#a5b4fc",
    headerText: "#ffffff",
    headerMuted: "#dbeafe",
    badgeBg: "rgba(15,23,42,.78)",
    badgeText: "#ffffff",
    shadow: "0 18px 50px rgba(15,23,42,.12)",
    darkPanel: "#111d35",
    darkPanelAlt: "#14213a",
    darkBorder: "#293b5d",
  };
}

function renderEmailRows(rows, options = {}) {
  const labelColor = options.labelColor ?? "#64748b";
  const valueColor = options.valueColor ?? "#0f172a";
  const borderColor = options.borderColor ?? "#e5e7eb";
  return rows
    .filter((row) => row && row.value !== null && row.value !== undefined && row.value !== "")
    .map((row) => `
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid ${borderColor};font-size:12px;line-height:1.35;color:${labelColor};font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(row.label)}</td>
        <td style="padding:11px 0;border-bottom:1px solid ${borderColor};font-size:13px;line-height:1.45;color:${valueColor};font-weight:700;text-align:right;">${escapeHtml(row.value)}</td>
      </tr>
    `).join("");
}

function renderChecklist(items, options = {}) {
  const color = options.color ?? "#172033";
  const checkColor = options.checkColor ?? "#2563eb";
  return items
    .filter(Boolean)
    .map((item) => `
      <tr>
        <td style="width:24px;padding:0 10px 10px 0;vertical-align:top;color:${checkColor};font-weight:900;">&#10003;</td>
        <td style="padding:0 0 10px 0;color:${color};font-size:13px;line-height:1.45;">${escapeHtml(item)}</td>
      </tr>
    `).join("");
}

function emailOuter(content, options = {}) {
  const background = options.background ?? "#f5f7fb";
  const fontFamily = options.fontFamily ?? "Aptos,Segoe UI,Calibri,Helvetica,Arial,sans-serif";
  return `
    <div style="margin:0;padding:0;background:${background};font-family:${fontFamily};color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${background};">
        <tr>
          <td align="center" style="padding:28px 12px;">
            ${content}
          </td>
        </tr>
      </table>
    </div>
  `;
}

function emailHeader({ title, subtitle, badge, dark = true, profile = getXAgentProfile(DANI_AGENT_SLUG) }) {
  const theme = emailTheme(profile);
  const heroBackground = dark
    ? theme.headerBackground
    : `linear-gradient(135deg,${theme.canvas} 0%,${theme.canvasAlt} 52%,${theme.soft} 100%)`;
  const titleColor = dark ? theme.headerText : theme.text;
  const subtitleColor = dark ? theme.headerMuted : theme.muted;
  const imageRadius = isHalProfile(profile) ? "18px" : "50%";
  return `
    <tr>
      <td style="padding:0;background:${theme.headerFallback};background:${heroBackground};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:26px 24px 22px 24px;vertical-align:top;">
              <div style="font-size:12px;font-weight:900;letter-spacing:.24em;color:${dark ? theme.eyebrow : theme.accent};text-transform:uppercase;">${escapeHtml(theme.brandLabel)}</div>
              <h1 style="margin:16px 0 8px 0;font-size:28px;line-height:1.05;color:${titleColor};font-family:Georgia,'Times New Roman',serif;font-weight:700;">${escapeHtml(title)}</h1>
              <p style="margin:0;font-size:13px;line-height:1.5;color:${subtitleColor};">${escapeHtml(subtitle)}</p>
            </td>
            <td align="right" style="width:150px;padding:20px 24px 20px 0;vertical-align:top;">
              <img src="${profile.emailImageUrl}" width="96" height="96" alt="${escapeHtml(profile.displayName)}" style="display:block;width:96px;height:96px;border-radius:${imageRadius};object-fit:cover;border:2px solid rgba(255,255,255,.72);box-shadow:0 14px 34px rgba(17,20,23,.35);" />
              ${badge ? `<div style="margin-top:10px;padding:9px 10px;border-radius:12px;background:${dark ? theme.badgeBg : theme.canvas};color:${dark ? theme.badgeText : theme.text};font-size:12px;line-height:1.2;font-weight:900;text-align:center;box-shadow:0 10px 24px rgba(15,23,42,.18);">${badge}</div>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildUserFollowupHtml(insights, schedulingContext, profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  const hal = isHalProfile(profile);
  const theme = emailTheme(profile);
  const calendlyText = buildCalendlyCta(schedulingContext, insights, profile);
  const calendlyLink = firstUrl(calendlyText);
  const requestedMaterials = insights.requestedMaterials.length > 0
    ? insights.requestedMaterials.join("; ")
    : "None requested";
  const meetingTimeDisplay = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior notes)" : ""}`
    : "Not specified";
  const greetingName = insights.visitorName && insights.visitorName !== "there" ? insights.visitorName : "there";
  return emailOuter(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;border-collapse:separate;border-spacing:0;background:${theme.canvas};border:1px solid ${theme.border};border-radius:14px;overflow:hidden;box-shadow:${theme.shadow};">
      ${emailHeader({
        title: hal ? "Hal session recap and next-step briefing" : `Thanks for speaking with ${profile.displayName}.`,
        subtitle: hal
          ? "A boardroom-grade memo of what mattered, what can move, and what should stay human-reviewed."
          : "Here are the follow-up details and next steps captured from your session.",
        badge: hal ? "Operator<br>memo" : "30 min demo",
        dark: true,
        profile,
      })}
      <tr>
        <td style="padding:26px 28px 8px 28px;">
          <p style="margin:0 0 18px 0;font-size:14px;color:${theme.accent};font-weight:900;letter-spacing:.02em;">Hi ${escapeHtml(greetingName)},</p>
          <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:${theme.muted};">${hal
            ? `Thank you for spending time with ${escapeHtml(profile.displayName)}. This recap captures the useful signal from the session while keeping decisions, commitments, and external actions in human-review territory.`
            : `Thank you for spending time with ${escapeHtml(profile.displayName)}. We captured your request and prepared the follow-up for review.`}</p>
          <div style="border:1px solid ${theme.border};border-radius:12px;padding:18px 20px;background:${theme.canvasAlt};">
            ${hal ? `<div style="height:4px;width:72px;background:${theme.accent};border-radius:99px;margin:0 0 14px 0;"></div>` : ""}
            <h2 style="margin:0 0 12px 0;font-size:16px;color:${theme.text};font-family:${hal ? "Georgia,'Times New Roman',serif" : "inherit"};">${hal ? "TL;DR / Session Brief" : "Discussion Summary"}</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              ${renderEmailRows([
                { label: hal ? "Executive / Context" : "Business / Context", value: formatEmailValue(insights.company) },
                { label: hal ? "Autopilot Thread" : "Requested Next Step", value: hal ? insights.focus : insights.requestedAction },
                { label: hal ? "Requested Follow-up" : "Requested Meeting Time", value: hal ? insights.requestedAction : meetingTimeDisplay },
                { label: hal ? "Human Handoff Window" : "Primary Topic", value: hal ? meetingTimeDisplay : insights.focus },
                { label: "Requested Materials", value: requestedMaterials },
              ], { labelColor: hal ? theme.accentDark : undefined, valueColor: hal ? theme.text : undefined, borderColor: hal ? theme.border : undefined })}
            </table>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 8px 28px;">
          <div style="border-radius:12px;padding:18px 20px;background:${hal ? theme.darkPanel : "linear-gradient(135deg,#060b22 0%,#15164e 60%,#6d28d9 100%)"};color:#ffffff;border:${hal ? `1px solid ${theme.darkBorder}` : "0"};">
            <h2 style="margin:0 0 8px 0;font-size:16px;color:#ffffff;">${hal ? "Human Handoff / Confirmation" : "Scheduling / Confirmation"}</h2>
            <p style="margin:0;font-size:14px;line-height:1.55;color:${hal ? theme.headerMuted : "#e0e7ff"};">${insights.meetingTime ? `You mentioned this meeting time: <strong>${escapeHtml(insights.meetingTime)}</strong>.` : hal ? "No specific handoff or meeting time was captured." : "No specific meeting time was captured."}</p>
          </div>
        </td>
      </tr>
      ${calendlyLink ? `
      <tr>
        <td style="padding:8px 28px 16px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid ${theme.border};border-radius:12px;background:${theme.soft};">
            <tr>
              <td style="padding:16px 18px;">
                <div style="font-size:15px;font-weight:900;color:${theme.text};margin-bottom:5px;">Let's lock in your ${escapeHtml(profile.calendlyMeetingLabel)}</div>
                <div style="font-size:12px;line-height:1.45;color:${theme.muted};">Choose the closest available 30-minute time that works best for you.</div>
              </td>
              <td align="right" style="padding:16px 18px;width:210px;">
                <a href="${escapeHtml(calendlyLink)}" style="display:inline-block;background:${theme.accentDark};color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 16px;font-size:13px;font-weight:900;">Choose your time &#8594;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ""}
      <tr>
        <td style="padding:0 28px 26px 28px;">
          <div style="border:1px solid ${theme.border};border-radius:10px;background:${theme.canvas};padding:14px 16px;color:${theme.muted};font-size:13px;line-height:1.55;">
            <strong style="color:${theme.text};">Please note:</strong> ${hal ? "Hal does not claim completed external actions unless the connected app or a human confirms them." : "a meeting is not considered scheduled until you confirm a time or the AI Fusion Labs team confirms availability."}
          </div>
          <p style="margin:18px 0 0 0;font-size:14px;line-height:1.55;color:${theme.muted};">${hal ? "The useful work is separating what can be safely automated from what should be handed back to a human with context." : (escapeHtml(formatEmailValue(insights.company, "AI Fusion Labs")) ? `Looking forward to helping ${escapeHtml(formatEmailValue(insights.company, "your team"))} move forward with clarity.` : "Looking forward to helping you move forward with clarity.")}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">
            <tr>
              <td style="padding-right:10px;"><img src="${profile.emailImageUrl}" width="42" height="42" alt="${escapeHtml(profile.displayName)}" style="display:block;width:42px;height:42px;border-radius:${hal ? "10px" : "50%"};object-fit:cover;border:1px solid ${theme.border};" /></td>
              <td style="font-size:13px;color:${theme.muted};line-height:1.35;"><strong style="display:block;color:${theme.text};">${escapeHtml(profile.displayName)}</strong>${escapeHtml(profile.emailRoleLine)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `, { background: theme.background });
}

function buildAdminSummaryHtml(
  insights,
  providerConversationId,
  transcriptSignals,
  schedulingContext,
  profile = getXAgentProfile(DANI_AGENT_SLUG),
  transcriptMetadata = {},
  generatedAt = "",
) {
  const hal = isHalProfile(profile);
  const theme = emailTheme(profile);
  const meetingTimeDisplay = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior notes)" : ""}`
    : "Not specified";
  return emailOuter(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:660px;border-collapse:separate;border-spacing:0;background:${theme.darkPanel};border:1px solid ${theme.darkBorder};border-radius:14px;overflow:hidden;box-shadow:${theme.shadow};">
      ${emailHeader({
        title: hal ? "Hal Session Operations Brief" : `New ${profile.displayName} Intake`,
        subtitle: hal
          ? "Internal operator view with session detail, follow-up intent, and human-review boundaries."
          : "Operator action required. A new intake has been captured and requires review.",
        badge: hal ? "Ops<br>brief" : "Review",
        dark: true,
        profile,
      })}
      <tr>
        <td style="padding:22px 24px 24px 24px;background:${theme.darkPanel};">
          ${[
            {
              number: "1",
              title: "Session Details",
              rows: buildSessionDetailRows(providerConversationId, transcriptSignals, transcriptMetadata, generatedAt),
            },
            {
              number: "2",
              title: "Contact / Context",
              rows: [
                { label: "Visitor name heard", value: formatEmailValue(insights.visitorName) },
                { label: "Business / Context", value: formatEmailValue(insights.company) },
                { label: "Email / Contact Status", value: "Captured" },
                { label: "Prior memory consulted", value: insights.priorMemoryUsedForEmailContext ? "Yes" : "No" },
              ],
            },
            {
              number: "3",
              title: hal ? "Autopilot Request Details" : "Request Details",
              rows: [
                { label: "Requested action", value: insights.requestedAction },
                { label: "Requested meeting time", value: meetingTimeDisplay },
                { label: "Primary workflow", value: insights.focus },
                { label: "Calendly CTA included", value: schedulingContext.calendlyCtaIncluded ? "Yes" : "No" },
              ],
            },
            {
              number: "4",
              title: hal ? "Human Handoff / Follow-up" : "Scheduling / Follow-up",
              checklist: [
                insights.meetingTime ? `Prioritize confirming the requested ${insights.meetingTime} meeting window.` : "No specific meeting time was detected.",
                "Do not claim the meeting is scheduled until Calendly or a human confirms it.",
                "If the exact time is unavailable, offer the closest available option.",
              ],
            },
            {
              number: "5",
              title: "Operator Action Plan",
              checklist: [
                hal ? "Review the session recap and identify what Hal can safely automate versus what needs human approval." : "Review the transcript and intake context.",
                hal ? "Prepare a concise executive handoff if the visitor requested a briefing, decision memo, or meeting prep." : "Confirm whether a meeting invite or direct follow-up is needed.",
                hal ? "Do not represent any email, calendar, CRM, or meeting action as complete until the app confirms it." : "Verify availability before sending any calendar commitment.",
              ],
            },
          ].map((section) => `
            <div style="margin:0 0 12px 0;border:1px solid ${theme.darkBorder};border-radius:12px;background:${theme.darkPanelAlt};padding:16px;">
              <h2 style="margin:0 0 12px 0;color:${theme.headerText};font-size:16px;line-height:1.2;font-family:${hal ? "Georgia,'Times New Roman',serif" : "inherit"};"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${hal ? theme.accent : "#7c3aed"};color:#ffffff;text-align:center;line-height:22px;font-size:12px;margin-right:8px;">${section.number}</span>${escapeHtml(section.title)}</h2>
              ${section.rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${renderEmailRows(section.rows, { labelColor: hal ? theme.eyebrow : "#9fb2d8", valueColor: theme.headerText, borderColor: theme.darkBorder })}</table>` : ""}
              ${section.checklist ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${renderChecklist(section.checklist, { color: theme.headerMuted, checkColor: hal ? theme.eyebrow : "#7dd3fc" })}</table>` : ""}
            </div>
          `).join("")}
          <a href="https://x-agent-website-t.vercel.app/admin/hermes-email-memory-preview" style="display:block;margin-top:18px;background:${hal ? theme.accentDark : "linear-gradient(90deg,#7c3aed,#2563eb)"};color:#ffffff;text-align:center;text-decoration:none;border-radius:8px;padding:15px 18px;font-size:14px;font-weight:900;">${hal ? "Review Hal Operations Brief" : "Review Intake Details"} &#8594;</a>
        </td>
      </tr>
    </table>
  `, { background: theme.background });
}

function buildLeadIntelHtml(insights, transcriptSignals, schedulingContext, profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  const hal = isHalProfile(profile);
  const theme = emailTheme(profile);
  const meeting = insights.meetingTime ?? "Not specified";
  return emailOuter(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:690px;border-collapse:separate;border-spacing:0;background:${theme.canvas};border:1px solid ${theme.border};border-radius:14px;overflow:hidden;box-shadow:${theme.shadow};">
      ${emailHeader({
        title: profile.leadIntelTitle,
        subtitle: hal ? "Executive-autopilot signal, decision handoff, and next-best action." : "AI-powered insights. Human-ready next steps.",
        badge: hal ? `Fit<br><span style="font-size:28px;line-height:1;">${insights.leadScore}/10</span>` : `Score<br><span style="font-size:28px;line-height:1;">${insights.leadScore}/10</span>`,
        dark: true,
        profile,
      })}
      <tr>
        <td style="padding:22px 28px 8px 28px;">
          <p style="margin:0 0 18px 0;font-size:14px;line-height:1.55;color:${theme.muted};">Hi Team,<br />${hal ? `Here is the post-session executive-autopilot brief for ${escapeHtml(profile.displayName)}. It highlights useful signal, handoff requirements, and the next decision to review.` : `Here is the post-session intelligence snapshot for ${escapeHtml(profile.displayName)}. High-intent signals and recommended next steps are ready for review.`}</p>
          ${[
            {
              title: hal ? "1. Executive / Context" : "1. Contact / Account",
              rows: [
                { label: hal ? "Autopilot fit" : "Lead temperature", value: insights.returningVisitor ? "Returning warm lead" : "New / unknown lead" },
                { label: "Account context", value: formatEmailValue(insights.company) },
                { label: "Visitor name heard", value: formatEmailValue(insights.visitorName) },
              ],
            },
            {
              title: hal ? "2. Autopilot Signals" : "2. Opportunity Signals",
              rows: [
                { label: "Intent signal", value: insights.requestedAction },
                { label: "Workflow interest", value: insights.focus },
                { label: "Scheduling intent", value: meeting },
                { label: "Calendly CTA included", value: schedulingContext.calendlyCtaIncluded ? "Yes" : "No" },
                { label: "User turns captured", value: String(transcriptSignals.user_turn_count) },
              ],
            },
            {
              title: "3. Recommended Next Steps",
              checklist: [
                insights.meetingTime ? `Prioritize the requested ${insights.meetingTime} meeting window.` : "Send a concise confirmation using the user-facing follow-up.",
                hal ? "Prepare a short executive handoff around context, decision points, and unresolved approvals." : "Prepare the meeting around the requested workflow and known context.",
                "Avoid claiming any invite or external system update occurred until confirmed.",
              ],
            },
          ].map((section) => `
            <div style="margin:0 0 14px 0;border:1px solid ${theme.border};border-radius:12px;background:${theme.canvasAlt};padding:16px 18px;">
              <h2 style="margin:0 0 12px 0;color:${theme.text};font-size:15px;line-height:1.25;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(section.title)}</h2>
              ${section.rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${renderEmailRows(section.rows, { labelColor: hal ? theme.accentDark : undefined, valueColor: hal ? theme.text : undefined, borderColor: hal ? theme.border : undefined })}</table>` : ""}
              ${section.checklist ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${renderChecklist(section.checklist, { color: hal ? theme.muted : undefined, checkColor: hal ? theme.accentCool : undefined })}</table>` : ""}
            </div>
          `).join("")}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-collapse:collapse;background:${theme.darkPanel};border-radius:12px;overflow:hidden;">
            <tr>
              ${[
                ["Prospect Score", `${insights.leadScore}/10`],
                [hal ? "Handoff Signal" : "Intent Level", insights.meetingRequested ? "High" : "Moderate"],
                [hal ? "Review Window" : "Meeting Window", meeting],
                [hal ? "Autopilot Thread" : "Workflow", insights.focus],
                ["Turns Captured", String(transcriptSignals.user_turn_count)],
              ].map(([label, value]) => `
                <td align="center" style="padding:16px 8px;border-right:1px solid rgba(255,255,255,.12);">
                  <div style="font-size:12px;color:${hal ? theme.eyebrow : "#93c5fd"};text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(label)}</div>
                  <div style="margin-top:6px;font-size:15px;color:${theme.headerText};font-weight:900;">${escapeHtml(value)}</div>
                </td>
              `).join("")}
            </tr>
          </table>
          <a href="https://x-agent-website-t.vercel.app/admin/hermes-email-memory-preview" style="display:block;margin:0 auto 14px auto;max-width:360px;background:${hal ? theme.accentDark : "linear-gradient(90deg,#7c3aed,#2563eb)"};color:#ffffff;text-align:center;text-decoration:none;border-radius:8px;padding:14px 18px;font-size:14px;font-weight:900;">${hal ? "Open Executive Brief" : "Open Opportunity Brief"} &#8594;</a>
          <p style="margin:0 0 22px 0;text-align:center;font-size:12px;color:${theme.muted};">${hal ? "Autopilot where safe. Human judgment where it matters." : "AI insights. Human conversations. Better outcomes."}</p>
        </td>
      </tr>
    </table>
  `, { background: theme.background });
}

function buildDesignedEmailHtmlPreview({
  actionType,
  bodyText,
  insights,
  schedulingContext,
  transcriptSignals,
  providerConversationId,
  profile = getXAgentProfile(DANI_AGENT_SLUG),
  transcriptMetadata = {},
  generatedAt = "",
}) {
  if (actionType === "email.user_followup") {
    return buildUserFollowupHtml(insights, schedulingContext, profile);
  }
  if (actionType === "email.admin_summary") {
    return buildAdminSummaryHtml(
      insights,
      providerConversationId,
      transcriptSignals,
      schedulingContext,
      profile,
      transcriptMetadata,
      generatedAt,
    );
  }
  if (actionType === "email.lead_intel") {
    return buildLeadIntelHtml(insights, transcriptSignals, schedulingContext, profile);
  }
  return buildEmailHtmlPreview(bodyText);
}

function buildEmailHtmlPreview(bodyText) {
  const headings = new Set([
    "What The Agent Captured",
    "Helpful Context",
    "TL;DR",
    "Session Summary",
    "Scheduling",
    "Human Handoff / Next Steps",
    "Autopilot Notes",
    "Next Step",
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
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;max-width:720px;background:#ffffff;">',
    '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:22px 24px;">',
    ...sections,
    "</div>",
    "</div>",
  ].join("");
}

function buildCalendlyCta({ calendlyUrl, meetingRequested }, insights = {}, profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  if (!calendlyUrl) return "";
  let schedulingUrl = calendlyUrl;
  try {
    const parsed = new URL(calendlyUrl);
    parsed.searchParams.set("utm_source", "xagent");
    parsed.searchParams.set("utm_medium", "email");
    parsed.searchParams.set("utm_campaign", profile.calendlyCampaign);
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
      `Use this meeting-specific link to choose or confirm the closest available ${CALENDLY_MEETING_LENGTH} ${profile.calendlyMeetingLabel}: ${schedulingUrl}`,
      "If that exact time is not open, the AI Fusion Labs team can coordinate the closest available option.",
    ].join("\n");
  }
  if (meetingRequested) {
    return `Use this link to choose a ${CALENDLY_MEETING_LENGTH} ${profile.calendlyMeetingLabel}: ${schedulingUrl}`;
  }
  return `If a deeper walkthrough would be helpful, you can book a ${CALENDLY_MEETING_LENGTH} ${profile.calendlyMeetingLabel} here: ${schedulingUrl}`;
}

function buildVisitorFollowupEmail(insights, schedulingContext, profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  const greetingName = insights.visitorName && insights.visitorName !== "there" ? ` ${insights.visitorName}` : "";
  const calendlyCta = buildCalendlyCta(schedulingContext, insights, profile);
  const schedulingHeading = insights.meetingTime ? "Scheduling" : "Schedule a Time";
  const meetingTimeDisplay = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior conversation notes)" : ""}`
    : "not specified";
  const requestedMaterials = insights.requestedMaterials.length > 0
    ? insights.requestedMaterials.join("; ")
    : null;
  if (isHalProfile(profile)) {
    return [
      `Hi${greetingName},`,
      "",
      `Thank you for spending time with ${profile.displayName}. I captured the useful signal from the session and separated the likely autopilot work from anything that still needs human review.`,
      "",
      "TL;DR",
      bullet([
        insights.company ? `Context: ${insights.company}` : "Context: not specified",
        `Main thread: ${insights.focus}`,
        `Requested follow-up: ${insights.requestedAction}`,
        `Requested handoff or meeting time: ${meetingTimeDisplay}`,
        requestedMaterials ? `Requested materials: ${requestedMaterials}` : null,
      ]),
      "",
      "Session Summary",
      insights.company
        ? `The working context is ${insights.company}. The session centered on ${insights.focus}, with the requested next step captured for review.`
        : `The session centered on ${insights.focus}, with the requested next step captured for review.`,
      "",
      "Human Handoff / Next Steps",
      bullet([
        calendlyCta ? calendlyCta : "AI Fusion Labs can review the recap and determine the right next step.",
        "No meeting, email, CRM update, or external action should be treated as complete until a connected app or human confirms it.",
        "The goal is to make the next human decision faster, clearer, and better prepared.",
      ]),
      "",
      "Best regards,",
      profile.displayName,
      profile.emailRoleLine,
    ].filter((line) => line !== null).join("\n");
  }
  return [
    `Hi${greetingName},`,
    "",
    insights.meetingTimeSource === "prior_memory"
      ? `Thank you for speaking with ${profile.displayName} again. We connected this session to your prior notes and prepared the follow-up request for review.`
      : insights.meetingTime
      ? `Thank you for speaking with ${profile.displayName}. We captured your requested meeting window and the follow-up items you asked us to include.`
      : `Thank you for spending time with ${profile.displayName}. We captured your request and prepared the next step for review.`,
    "",
    `What ${profile.displayName} Captured`,
    bullet([
      insights.company ? `Business/context: ${insights.company}` : null,
      `Requested next step: ${insights.requestedAction}`,
      `Requested meeting time: ${meetingTimeDisplay}`,
      `Primary topic: ${insights.focus}`,
      requestedMaterials ? `Requested materials: ${requestedMaterials}` : null,
    ]),
    "",
    "Helpful Context",
    insights.company
      ? `The current working context is ${insights.company} and the ${insights.focus} workflow. The team can use this as the starting point for the recap and meeting prep.`
      : `The team can use this session as the starting point for the recap and meeting prep around ${insights.focus}.`,
    calendlyCta ? "" : null,
    calendlyCta ? schedulingHeading : null,
    calendlyCta || null,
    "",
    insights.meetingTime
      ? "We will not call the meeting scheduled until a booking or team confirmation is complete, but this gives the team the exact window you asked about."
      : "If you have already chosen a time, no extra action is needed. Otherwise, the AI Fusion Labs team will review the request and follow up with the appropriate details.",
    "",
    "Next Step",
    requestedMaterials
      ? "The follow-up should include the recap and any approved onboarding or prep materials the team has available."
      : "The AI Fusion Labs team will review the request and follow up with the appropriate details.",
    "",
    "Best regards,",
    profile.displayName,
  ].filter((line) => line !== null).join("\n");
}

function buildAdminSummaryEmail(
  insights,
  providerConversationId,
  transcriptSignals,
  schedulingContext,
  profile = getXAgentProfile(DANI_AGENT_SLUG),
  transcriptMetadata = {},
  generatedAt = "",
) {
  const meetingTimeDisplay = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior conversation notes)" : ""}`
    : "not specified";
  const requestedMaterials = insights.requestedMaterials.length > 0
    ? insights.requestedMaterials.join("; ")
    : "none detected";
  const sessionRows = buildSessionDetailRows(providerConversationId, transcriptSignals, transcriptMetadata, generatedAt);
  return [
    profile.intakeBriefTitle,
    "",
    isHalProfile(profile)
      ? "Internal support note: this is the Hal operator/admin view. Treat it as a review brief, not as proof that an external action was completed."
      : `Conversation ID: ${providerConversationId}`,
    "",
    "Session Details",
    bullet(sessionRows.map((row) => `${row.label}: ${row.value}`)),
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
      `Requested materials: ${requestedMaterials}`,
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
      insights.requestedMaterials.length > 0
        ? `Include or review requested materials: ${requestedMaterials}.`
        : null,
      "Do not tell the visitor a meeting is scheduled until Calendly or a human confirms the booking.",
      "If the exact requested time is unavailable, offer the closest available option.",
    ]),
    "",
    "Operator Action Plan",
    bullet([
      isHalProfile(profile)
        ? "Review the session recap and decide what can safely move to autopilot versus what needs human approval."
        : "Review the transcript and confirm whether a meeting invite or direct follow-up is needed.",
      isHalProfile(profile)
        ? "If the visitor requested a briefing, prepare a concise executive handoff with the decision points and open questions."
        : "Watch for a Calendly booking before claiming anything is scheduled.",
      isHalProfile(profile)
        ? "Treat the transcript attachment on the intelligence email as the raw review artifact."
        : "If the visitor requested a specific time, confirm availability before sending a calendar commitment.",
    ]),
  ].join("\n");
}

function buildLeadIntelEmail(insights, transcriptSignals, schedulingContext, profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  const hal = isHalProfile(profile);
  const schedulingIntent = insights.meetingTime
    ? `${insights.meetingTime}${insights.meetingTimeSource === "prior_memory" ? " (from prior conversation notes)" : ""}`
    : "not specified";
  const requestedMaterials = insights.requestedMaterials.length > 0
    ? insights.requestedMaterials.join("; ")
    : "none detected";
  return [
    profile.leadIntelTitle,
    "",
    `Prospect Score: ${insights.leadScore}/10`,
    "",
    hal ? "Executive Autopilot Readout" : "Executive Readout",
    bullet([
      hal
        ? (insights.returningVisitor ? "Returning executive-autopilot conversation with active follow-up intent." : "New executive-autopilot conversation with early follow-up intent.")
        : (insights.returningVisitor ? "Returning visitor with active follow-up intent." : "New or unknown visitor with early-stage follow-up intent."),
      insights.company ? sentence(`Known account context: ${insights.company}`) : null,
      insights.meetingTime ? sentence(`Requested meeting window: ${insights.meetingTime}`) : null,
      insights.requestedMaterials.length > 0 ? sentence(`Requested materials: ${requestedMaterials}`) : null,
    ]),
    "",
    hal ? "Executive / Context" : "Contact / Account",
    bullet([
      `${hal ? "Autopilot fit" : "Lead temperature"}: ${insights.returningVisitor ? "returning warm lead" : "new/unknown lead"}`,
      insights.company ? `Account context: ${insights.company}` : null,
      insights.visitorName ? `Visitor name heard: ${insights.visitorName}` : null,
    ]),
    "",
    hal ? "Autopilot Signals" : "Opportunity Signals",
    bullet([
      `Intent signal: ${insights.requestedAction}`,
      `Workflow interest: ${insights.focus}`,
      `Scheduling intent: ${schedulingIntent}`,
      `Requested materials: ${requestedMaterials}`,
      `Calendly CTA included: ${schedulingContext.calendlyCtaIncluded ? "yes" : "no"}`,
      `User turns captured: ${transcriptSignals.user_turn_count}`,
    ]),
    "",
    "Recommended Next Steps",
    bullet([
      insights.meetingTime
        ? `Prioritize the requested ${insights.meetingTime} meeting window in the operator follow-up.`
        : "Send a concise confirmation using the user-facing follow-up.",
      hal
        ? "Prepare the handoff around context, likely autonomous work, decisions that need approval, and open questions."
        : "Prepare the meeting around the requested workflow and known context.",
      "Avoid claiming any calendar invite or external system update occurred until the tool confirms it.",
    ]),
  ].join("\n");
}

function buildActionId(providerConversationId, actionType, profile = getXAgentProfile(DANI_AGENT_SLUG)) {
  return `hxemail_${sha256(`${OPERATOR_VERSION}:${profile.agentSlug}:${providerConversationId}:${actionType}`).slice(0, 16)}`;
}

function buildDraftAction({
  actionType,
  providerConversationId,
  subject,
  bodyText,
  recipientPolicy,
  providerCandidate,
  insights,
  schedulingContext,
  transcriptSignals,
  transcriptMetadata = {},
  generatedAt = "",
  profile = getXAgentProfile(DANI_AGENT_SLUG),
}) {
  const safeBodyText = truncateMultiline(redactEmailLikeText(bodyText), MAX_EMAIL_BODY_LENGTH);
  return {
    action_id: buildActionId(providerConversationId, actionType, profile),
    action_type: actionType,
    status: "draft_ready_send_blocked",
    draft_created: true,
    send_attempted: false,
    send_completed: false,
    provider_candidate: providerCandidate,
    recipient_policy: recipientPolicy,
    subject_preview: truncate(subject, 140),
    body_text_preview: safeBodyText,
    body_html_preview: buildDesignedEmailHtmlPreview({
      actionType,
      bodyText: safeBodyText,
      insights,
      schedulingContext,
      transcriptSignals,
      transcriptMetadata,
      generatedAt,
      providerConversationId,
      profile,
    }),
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
  const agentSlug = resolveXAgentSlug(options.agentSlug);
  const profile = getXAgentProfile(agentSlug);
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
    calendlyMeetingLabel: profile.calendlyMeetingLabel,
    calendlyMeetingLength: CALENDLY_MEETING_LENGTH,
    calendlyTimezone: CALENDLY_TIMEZONE,
  };
  const createdAt = nowIso(options.now);
  const adminRecipientPolicy = options.adminRecipientConfigured
    || Boolean(env(profile.adminRecipientEnv, envSource))
    || Boolean(env(ADMIN_RECIPIENT_ENV, envSource))
    ? "configured_internal_recipient_redacted"
    : "internal_recipient_not_configured";
  const userRecipientPolicy = "typed_check_in_email_only";

  const userFollowup = buildDraftAction({
    actionType: "email.user_followup",
    providerConversationId,
    providerCandidate,
    recipientPolicy: userRecipientPolicy,
    subject: isHalProfile(profile)
      ? `${profile.displayName} session recap: executive-autopilot next steps`
      : `${profile.displayName} follow-up: ${emailInsights.meetingTime ?? "requested"} follow-up`,
    bodyText: buildVisitorFollowupEmail(emailInsights, schedulingContext, profile),
    insights: emailInsights,
    schedulingContext,
    transcriptSignals,
    transcriptMetadata,
    generatedAt: createdAt,
    profile,
  });

  const adminSummary = buildDraftAction({
    actionType: "email.admin_summary",
    providerConversationId,
    providerCandidate,
    recipientPolicy: adminRecipientPolicy,
    subject: isHalProfile(profile)
      ? `${profile.displayName} admin brief: ${emailInsights.requestedAction}`
      : `${profile.displayName} session: ${emailInsights.requestedAction}`,
    bodyText: buildAdminSummaryEmail(
      emailInsights,
      providerConversationId,
      transcriptSignals,
      schedulingContext,
      profile,
      transcriptMetadata,
      createdAt,
    ),
    insights: emailInsights,
    schedulingContext,
    transcriptSignals,
    transcriptMetadata,
    generatedAt: createdAt,
    profile,
  });

  const leadIntel = buildDraftAction({
    actionType: "email.lead_intel",
    providerConversationId,
    providerCandidate,
    recipientPolicy: adminRecipientPolicy,
    subject: isHalProfile(profile)
      ? `[HAL AUTOPILOT FIT ${emailInsights.leadScore}/10] Executive brief: ${emailInsights.company ?? "session review"}`
      : `[PROSPECT SCORE ${emailInsights.leadScore}/10] Lead intel: ${emailInsights.company ?? `${profile.displayName} returning visitor`}`,
    bodyText: buildLeadIntelEmail(emailInsights, transcriptSignals, schedulingContext, profile),
    insights: emailInsights,
    schedulingContext,
    transcriptSignals,
    transcriptMetadata,
    generatedAt: createdAt,
    profile,
  });

  return {
    operator_version: OPERATOR_VERSION,
    artifact_purpose: "xagent_hermes_email_communications_plan",
    tenant_id: profile.tenantId,
    agent_slug: profile.agentSlug,
    provider: TAVUS_PROVIDER,
    provider_conversation_id: providerConversationId,
    created_at: createdAt,
    communication_plan_id: `hxecp_${sha256(`${OPERATOR_VERSION}:${providerConversationId}:${createdAt}`).slice(0, 16)}`,
    mode: DRAFT_ONLY_MODE,
    configured_provider: provider,
    provider_recommendation: {
      first_controlled_live_send: PROVIDER_RESEND,
      replyable_agent_inbox: PROVIDER_AGENTMAIL,
      suggested_agentmail_username: profile.suggestedAgentMailUsername,
      suggested_agentmail_display_name: profile.suggestedAgentMailDisplayName,
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
  const agentSlug = resolveXAgentSlug(options.agentSlug ?? input.agentSlug);
  const agentOptions = { agentSlug };
  if (!areHermesEmailActionGatesOpen(envSource, agentOptions)) {
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

  const plan = buildHermesEmailCommunicationPlan(input, { ...options, agentSlug });
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
