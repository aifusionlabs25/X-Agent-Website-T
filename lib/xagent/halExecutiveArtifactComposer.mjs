import { createHash } from "crypto";
import { normalizeTranscriptTurns } from "./sessionCompletedPayload.mjs";

const COMPOSER_VERSION = "hal_executive_artifact_composer_v1";

const ARTIFACT_PATTERNS = [
  {
    type: "board_ready_summary",
    label: "Board-Ready Summary",
    pattern: /\b(?:board|investor|sequoia|partner update|board[-\s]?ready|board memo)\b/i,
  },
  {
    type: "founder_operating_memo",
    label: "Founder Operating Memo",
    pattern: /\b(?:founder operating memo|operating memo|operator memo|founder memo|operating cadence)\b/i,
  },
  {
    type: "growth_plan",
    label: "Five-Point Growth Plan",
    pattern: /\b(?:growth plan|revenue|pipeline|sales|marketing|go[-\s]?to[-\s]?market|gtm|five examples|5 examples|five next|5 next)\b/i,
  },
  {
    type: "meeting_prep_pack",
    label: "Meeting Prep Pack",
    pattern: /\b(?:meeting prep|prep pack|prepare me|interview|questions to ask|agenda)\b/i,
  },
  {
    type: "ceo_decision_brief",
    label: "CEO Decision Brief",
    pattern: /\b(?:decision brief|decide|decision|options|tradeoffs|recommendation)\b/i,
  },
  {
    type: "executive_action_brief",
    label: "Executive Action Brief",
    pattern: /\b(?:executive report|executive brief|ceo report|briefing|action plan|next moves|what should (?:i|we) do|report)\b/i,
  },
];

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function truncate(value, maxLength = 360) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function redactSensitiveText(value) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:[a-z0-9]\s*[- ]\s*){2,}[a-z0-9]?\s*(?:at|@)\s*(?:gmail|yahoo|outlook|hotmail)(?:\s*dot\s*|\.)\s*[a-z]{2,}\b/gi, "[email redacted]")
    .replace(/\b\+?\d[\d .()-]{7,}\d\b/g, "[phone redacted]")
    .replace(/\bprivate\s+google\s+drive\b/gi, "[unapproved private file reference]")
    .replace(/\bgoogle\s+drive\s+link\b/gi, "[unapproved file link reference]");
}

function userTextFromTranscript(transcript) {
  return normalizeTranscriptTurns(transcript)
    .filter((turn) => turn.role === "user")
    .map((turn) => redactSensitiveText(turn.content))
    .filter(Boolean)
    .join(" ");
}

function pickArtifactType(userText) {
  for (const candidate of ARTIFACT_PATTERNS) {
    if (candidate.pattern.test(userText)) return candidate;
  }
  return null;
}

function detectArtifactRequest(userText) {
  return Boolean(
    pickArtifactType(userText)
    || /\b(?:send|email|include|make|create|build|write|draft).{0,80}(?:brief|memo|report|plan|summary|next moves|recommendations)\b/i.test(userText)
    || /\b(?:brief|memo|report|plan|summary|recommendations).{0,80}(?:send|email|include|make|create|build|write|draft)\b/i.test(userText),
  );
}

function inferBusinessContext(userText, emailInsights = {}) {
  const company = emailInsights.company ? String(emailInsights.company).trim() : "";
  if (company) return truncate(company, 120);

  const contextPatterns = [
    /\b(?:my|our)\s+(?:business|company|startup|team)\s+(?:is|does|helps|sells|works on|builds|called)\s+([^.!?]{8,160})/i,
    /\b(?:we|i)\s+(?:run|operate|lead|founded|own)\s+([^.!?]{8,160})/i,
    /\b(?:for|about)\s+(?:my|our)\s+(?:business|company|startup|team)\s*,?\s+([^.!?]{8,160})/i,
  ];
  for (const pattern of contextPatterns) {
    const match = userText.match(pattern);
    if (match?.[1]) return truncate(match[1], 120);
  }
  return "the business context shared in the Hal session";
}

function inferObjective(userText, artifactLabel) {
  const directAsk = userText.match(/\b(?:help me|help us|give me|send me|create|build|write|draft|include)\s+([^.!?]{12,180})/i)?.[1];
  if (directAsk) return truncate(directAsk, 150);
  if (/\b(?:growth|revenue|sales|pipeline|marketing|gtm)\b/i.test(userText)) {
    return "identify the next growth moves and turn the session into an executable operator plan";
  }
  if (/\b(?:decision|tradeoff|option|recommendation)\b/i.test(userText)) {
    return "clarify the decision, surface tradeoffs, and define the human approval point";
  }
  if (/\b(?:meeting|prep|agenda|interview)\b/i.test(userText)) {
    return "prepare for the next meeting with tighter questions, context, and handoff boundaries";
  }
  return `turn the conversation into a useful ${artifactLabel.toLowerCase()} without claiming external work is complete`;
}

function focusFromInsights(emailInsights = {}) {
  const focus = String(emailInsights.focus ?? "").trim();
  if (focus && focus !== "X Agent workflow follow-up") return focus;
  return "executive-autopilot follow-up";
}

function nextMovesForType(type, context, focus) {
  const common = [
    `Turn the broad ${focus} conversation into one owner, one outcome, and one review date.`,
    "Separate reversible workflow automation from decisions that require founder or executive approval.",
    "Write down the data needed before any AI action can be trusted in production.",
    "Create a short approval rule: what Hal can draft, what Hal can recommend, and what Hal must hand back.",
    "Use the next follow-up to confirm priorities before connecting email, calendar, CRM, or meeting actions.",
  ];

  const byType = {
    growth_plan: [
      `Pick one segment inside ${context} where urgency, budget, and repeatability are already visible.`,
      "Define the top three buying triggers and turn each into a crisp outreach or content angle.",
      "Instrument the funnel before optimizing it: source, conversion point, owner, and follow-up SLA.",
      "Use Hal to draft weekly pipeline narratives, but keep pricing and commitments human-approved.",
      "Run a two-week test around one channel, one offer, and one measurable outcome before expanding.",
    ],
    meeting_prep_pack: [
      "Open the meeting with the decision the room needs, not a broad status update.",
      `Bring the ${focus} context, current blockers, and the desired end state into the first five minutes.`,
      "Ask where human judgment is still required before suggesting automation.",
      "Capture the unresolved owner, timeline, and risk after every major topic.",
      "Close with a written next-step recap that clearly labels drafts versus confirmed actions.",
    ],
    ceo_decision_brief: [
      "State the decision in one sentence and remove anything that is merely background.",
      "List the upside, downside, reversibility, and cost of waiting for each option.",
      "Name the approval owner before assigning Hal any follow-up work.",
      "Identify the smallest proof that would change the decision.",
      "Set a review date so the decision does not drift into permanent open-loop work.",
    ],
    board_ready_summary: [
      "Lead with the operating headline, then show the two or three signals that prove it.",
      "Separate facts, interpretation, and asks so reviewers can move quickly.",
      "Include the decision or support needed from the board instead of ending with general updates.",
      "Flag risks in plain language and attach an owner to each mitigation.",
      "Keep Hal's role as preparation and synthesis unless a human approves external distribution.",
    ],
    founder_operating_memo: [
      "Define the weekly operating cadence: inputs, decisions, owners, and review rhythm.",
      `Map ${focus} into a repeatable loop instead of a one-off conversation.`,
      "Move recurring synthesis to Hal while keeping high-trust commitments human-reviewed.",
      "Create an exception list for topics Hal should escalate immediately.",
      "Use the memo as the canonical context for the next Hal session.",
    ],
  };

  return byType[type] ?? common;
}

function buildSections({ type, artifactLabel, context, objective, focus }) {
  const nextMoves = nextMovesForType(type, context, focus);
  return [
    {
      heading: "Situation",
      items: [
        `Context: ${context}.`,
        `Objective: ${objective}.`,
        `Working thread: ${focus}.`,
      ],
    },
    {
      heading: artifactLabel.includes("Five") ? "Five Next Moves" : "Recommended Moves",
      items: nextMoves,
    },
    {
      heading: "Human Approval Boundary",
      items: [
        "Hal can draft, summarize, structure, and prepare follow-up language from approved context.",
        "Hal should not send calendar invites, update systems, commit resources, or imply Brian/executive approval without a tool receipt or human sign-off.",
        "The strongest next step is the smallest confirmed action with a visible owner.",
      ],
    },
  ];
}

export function buildHalExecutiveArtifact(input = {}, options = {}) {
  const userText = userTextFromTranscript(input.transcript);
  const requested = detectArtifactRequest(userText);
  if (!requested) {
    return {
      composer_version: COMPOSER_VERSION,
      artifact_requested: false,
      artifact_type: "none",
      artifact_label: "No executive artifact requested",
      safety: {
        raw_email_stored: false,
        raw_transcript_stored: false,
        external_action_claimed: false,
      },
    };
  }

  const candidate = pickArtifactType(userText) ?? {
    type: "executive_action_brief",
    label: "Executive Action Brief",
  };
  const emailInsights = input.emailInsights ?? {};
  const context = inferBusinessContext(userText, emailInsights);
  const focus = focusFromInsights(emailInsights);
  const objective = inferObjective(userText, candidate.label);
  const sections = buildSections({
    type: candidate.type,
    artifactLabel: candidate.label,
    context,
    objective,
    focus,
  });
  const createdAt = options.now instanceof Date
    ? options.now.toISOString()
    : String(options.now ?? new Date().toISOString());
  const artifactId = `halartifact_${sha256(`${COMPOSER_VERSION}:${candidate.type}:${context}:${objective}:${createdAt}`).slice(0, 16)}`;

  return {
    composer_version: COMPOSER_VERSION,
    artifact_id: artifactId,
    artifact_requested: true,
    artifact_type: candidate.type,
    artifact_label: candidate.label,
    title: `${candidate.label}: ${focus}`,
    summary: `Hal prepared a ${candidate.label.toLowerCase()} for ${context}, focused on ${objective}.`,
    business_context: context,
    objective,
    focus,
    sections,
    next_moves: sections.find((section) => /moves/i.test(section.heading))?.items ?? [],
    requested_by_transcript_signal: true,
    created_at: createdAt,
    safety: {
      raw_email_stored: false,
      raw_transcript_stored: false,
      external_action_claimed: false,
      human_review_required_before_execution: true,
    },
  };
}

export const HAL_EXECUTIVE_ARTIFACT_COMPOSER_VERSION = COMPOSER_VERSION;
