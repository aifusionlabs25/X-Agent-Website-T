const TRANSCRIPTION_READY_EVENT = "application.transcription_ready";
const TAVUS_GET_CONVERSATION_BASE_URL = "https://tavusapi.com/v2/conversations";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function findTranscriptionReadyEvent(verboseConversation) {
  const events = verboseConversation?.events;
  if (!Array.isArray(events)) {
    throw new Error("verbose conversation response must include events[]");
  }

  const event = events.find((item) => item?.event_type === TRANSCRIPTION_READY_EVENT);
  if (!event) {
    throw new Error("application.transcription_ready event was not found");
  }
  return event;
}

function mapTavusRole(role, index) {
  const normalizedRole = assertString(role, `properties.transcript[${index}].role`).toLowerCase();
  if (normalizedRole === "user") return "user";
  if (normalizedRole === "assistant") return "agent";
  if (normalizedRole === "system" || normalizedRole === "tool") {
    return null;
  }
  throw new Error(`properties.transcript[${index}].role must be user or assistant`);
}

export function extractTranscriptDetailsFromVerboseConversation(verboseConversation) {
  const event = findTranscriptionReadyEvent(verboseConversation);
  const sourceTranscript = event?.properties?.transcript;

  if (!Array.isArray(sourceTranscript) || sourceTranscript.length === 0) {
    throw new Error("application.transcription_ready properties.transcript must include at least one turn");
  }

  const transcript = [];
  const droppedRoles = new Set();
  let droppedNonMemoryTurnCount = 0;

  for (const [index, turn] of sourceTranscript.entries()) {
    if (!turn || typeof turn !== "object") {
      throw new Error(`properties.transcript[${index}] must be an object`);
    }

    const role = mapTavusRole(turn.role, index);
    if (!role) {
      droppedNonMemoryTurnCount += 1;
      droppedRoles.add(assertString(turn.role, `properties.transcript[${index}].role`).toLowerCase());
      continue;
    }

    transcript.push({
      role,
      content: assertString(turn.content, `properties.transcript[${index}].content`),
    });
  }

  if (transcript.length === 0) {
    throw new Error("no memory-safe user/agent transcript turns remain after filtering system/tool turns");
  }

  return {
    transcript,
    metadata: {
      source_turn_count: sourceTranscript.length,
      retained_memory_turn_count: transcript.length,
      dropped_non_memory_turn_count: droppedNonMemoryTurnCount,
      dropped_non_memory_roles: [...droppedRoles],
    },
  };
}

export function extractTranscriptFromVerboseConversation(verboseConversation) {
  return extractTranscriptDetailsFromVerboseConversation(verboseConversation).transcript;
}

export async function getConversationVerbose(conversationId, options = {}) {
  const apiKey = options.apiKey ?? env("TAVUS_API_KEY");
  const fetchImpl = options.fetchImpl ?? fetch;
  const id = encodeURIComponent(assertString(conversationId, "conversation_id"));
  const key = assertString(apiKey, "TAVUS_API_KEY");
  const url = `${TAVUS_GET_CONVERSATION_BASE_URL}/${id}?verbose=true`;

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "x-api-key": key,
    },
  });

  if (!response.ok) {
    const text = typeof response.text === "function" ? await response.text() : "";
    throw new Error(`Tavus getConversation verbose failed: ${response.status} ${text}`.trim());
  }

  return response.json();
}

export async function getTranscriptForConversation(conversationId, options = {}) {
  const verboseConversation = await getConversationVerbose(conversationId, options);
  return extractTranscriptFromVerboseConversation(verboseConversation);
}

export async function getTranscriptDetailsForConversation(conversationId, options = {}) {
  const verboseConversation = await getConversationVerbose(conversationId, options);
  return extractTranscriptDetailsFromVerboseConversation(verboseConversation);
}
