export const DANI_TAVUS_CUSTOM_GREETING =
  "Hi, I am Dani. What would you like to work through today?";

function cleanString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function buildCreateConversationBody(config, options = {}) {
  const body = {
    persona_id: config.personaId,
    replica_id: config.replicaId,
    custom_greeting: DANI_TAVUS_CUSTOM_GREETING,
    properties: {
      max_call_duration: config.maxCallSeconds,
      participant_absent_timeout: config.absentTimeout,
      participant_left_timeout: config.leftTimeout,
    },
  };

  const callbackUrl = cleanString(options.callbackUrl);
  if (callbackUrl) {
    body.callback_url = callbackUrl;
  }

  const conversationalContext = cleanString(options.conversationalContext);
  if (conversationalContext) {
    body.conversational_context = conversationalContext;
  }

  return body;
}
