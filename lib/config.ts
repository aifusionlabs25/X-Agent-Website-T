const env = (key: string) => process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";

export function tavusConfigForAgent(agentSlug = "dani") {
  const normalizedSlug = agentSlug.trim().toLowerCase();
  const isHal = normalizedSlug === "hal";

  return {
    tavusApiKey: env("TAVUS_API_KEY"),
    personaId: isHal ? env("HAL_TAVUS_PERSONA_ID") : env("TAVUS_PERSONA_ID"),
    replicaId: isHal ? env("HAL_TAVUS_REPLICA_ID") : env("TAVUS_REPLICA_ID"),
    customGreeting: isHal
      ? env("HAL_TAVUS_CUSTOM_GREETING") ||
        "Hey, I'm Hal. Good to meet you - what are you working through today and how can I assist?"
      : env("DANI_TAVUS_CUSTOM_GREETING"),
    maxCallSeconds: Number(process.env.DEMO_MAX_CALL_SECONDS ?? "720"),
    absentTimeout: Number(process.env.DEMO_PARTICIPANT_ABSENT_TIMEOUT ?? "30"),
    leftTimeout: Number(process.env.DEMO_PARTICIPANT_LEFT_TIMEOUT ?? "5"),
    retrievalStrategy: isHal
      ? process.env.HAL_DOC_RETRIEVAL_STRATEGY ?? process.env.DANI_DOC_RETRIEVAL_STRATEGY ?? "speed"
      : process.env.DANI_DOC_RETRIEVAL_STRATEGY ?? "speed",
    documentTag: isHal
      ? process.env.HAL_DOCUMENT_TAG ?? "hal-core"
      : process.env.DANI_DOCUMENT_TAG ?? "dani-core",
    agentSlug: normalizedSlug,
  };
}

export const cfg = tavusConfigForAgent("dani");
