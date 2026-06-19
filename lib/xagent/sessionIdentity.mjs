import { randomUUID } from "crypto";

export const DANI_TENANT_ID = "ai-fusion-labs";
export const DANI_AGENT_SLUG = "dani";
export const TAVUS_PROVIDER = "tavus";

function prefixedId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function createDaniSessionIdentity() {
  return {
    tenant_id: DANI_TENANT_ID,
    agent_slug: DANI_AGENT_SLUG,
    visitor_id: prefixedId("visitor"),
    session_id: prefixedId("xagent_session"),
    provider: TAVUS_PROVIDER,
  };
}

export function buildDaniConversationStartResponse(tavusConversation, startedAt, identity = createDaniSessionIdentity()) {
  return {
    ...tavusConversation,
    tenant_id: identity.tenant_id,
    agent_slug: identity.agent_slug,
    visitor_id: identity.visitor_id,
    session_id: identity.session_id,
    provider: identity.provider,
    provider_conversation_id: tavusConversation.conversation_id,
    startedAt,
  };
}
