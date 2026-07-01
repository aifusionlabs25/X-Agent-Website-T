import { DANI_AGENT_SLUG, DANI_TENANT_ID, HAL_AGENT_SLUG } from "./sessionIdentity.mjs";

const EMAIL_ASSET_BASE_URL = "https://x-agent-website-t.vercel.app";

const AGENT_PROFILES = {
  [DANI_AGENT_SLUG]: {
    tenantId: DANI_TENANT_ID,
    agentSlug: DANI_AGENT_SLUG,
    displayName: "Dani",
    emailRoleLine: "AI Concierge, X Agents",
    emailImageUrl: `${EMAIL_ASSET_BASE_URL}/agents/thumbnails/dani-tavus-custom-replica.png`,
    agentMailAddressEnv: "XAGENT_DANI_AGENTMAIL_ADDRESS",
    agentMailApiKeyEnv: "AGENTMAIL_API_KEY",
    agentMailAdapterPilotEnv: "XAGENT_DANI_AGENTMAIL_ADAPTER_PILOT_ENABLED",
    agentMailSendAdapterPilotEnv: "XAGENT_DANI_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED",
    hermesEmailActionsPilotEnv: "XAGENT_DANI_HERMES_EMAIL_ACTIONS_PILOT_ENABLED",
    adminRecipientEnv: "XAGENT_HERMES_EMAIL_ADMIN_RECIPIENT",
    expectedAgentMailAddress: "danixagent@agentmail.to",
    calendlyMeetingLabel: "Dani Demo Call",
    calendlyCampaign: "dani_followup",
    suggestedAgentMailUsername: "dani-xagent",
    suggestedAgentMailDisplayName: "Dani X Agent SDR",
    defaultFollowupSubject: "Dani X Agent follow-up",
    intakeBriefTitle: "New Dani Intake Brief",
    leadIntelTitle: "Dani Lead Intelligence Report",
    transcriptTitle: "Dani X Agent Transcript",
    transcriptFilenamePrefix: "dani-transcript",
    agentMailLabel: "dani",
  },
  [HAL_AGENT_SLUG]: {
    tenantId: DANI_TENANT_ID,
    agentSlug: HAL_AGENT_SLUG,
    displayName: "Hal",
    emailRoleLine: "Executive Autopilot Interface, X Agents",
    emailImageUrl: `${EMAIL_ASSET_BASE_URL}/agents/hal/hal-newest-2026-06-30.png`,
    agentMailAddressEnv: "XAGENT_HAL_AGENTMAIL_ADDRESS",
    agentMailApiKeyEnv: "HAL_AGENTMAIL_API_KEY",
    agentMailAdapterPilotEnv: "XAGENT_HAL_AGENTMAIL_ADAPTER_PILOT_ENABLED",
    agentMailSendAdapterPilotEnv: "XAGENT_HAL_AGENTMAIL_SEND_ADAPTER_PILOT_ENABLED",
    hermesEmailActionsPilotEnv: "XAGENT_HAL_HERMES_EMAIL_ACTIONS_PILOT_ENABLED",
    adminRecipientEnv: "XAGENT_HAL_HERMES_EMAIL_ADMIN_RECIPIENT",
    expectedAgentMailAddress: "hermes-hal@agentmail.to",
    calendlyMeetingLabel: "Hal Executive Autopilot Review",
    calendlyCampaign: "hal_followup",
    suggestedAgentMailUsername: "hermes-hal",
    suggestedAgentMailDisplayName: "Hal Executive Autopilot Interface",
    defaultFollowupSubject: "Hal follow-up",
    intakeBriefTitle: "New Hal Intake Brief",
    leadIntelTitle: "Hal Executive Intelligence Report",
    transcriptTitle: "Hal X Agent Transcript",
    transcriptFilenamePrefix: "hal-transcript",
    agentMailLabel: "hal",
  },
};

export function resolveXAgentSlug(agentSlug = DANI_AGENT_SLUG) {
  return agentSlug === HAL_AGENT_SLUG ? HAL_AGENT_SLUG : DANI_AGENT_SLUG;
}

export function getXAgentProfile(agentSlug = DANI_AGENT_SLUG) {
  return AGENT_PROFILES[resolveXAgentSlug(agentSlug)];
}

export function getXAgentProfileFromOptions(options = {}) {
  return getXAgentProfile(options.agentSlug);
}
