export const cfg = {
  tavusApiKey: process.env.TAVUS_API_KEY!,
  personaId: process.env.TAVUS_PERSONA_ID!,
  replicaId: process.env.TAVUS_REPLICA_ID!,
  maxCallSeconds: Number(process.env.DEMO_MAX_CALL_SECONDS ?? "120"),
  absentTimeout: Number(process.env.DEMO_PARTICIPANT_ABSENT_TIMEOUT ?? "30"),
  leftTimeout: Number(process.env.DEMO_PARTICIPANT_LEFT_TIMEOUT ?? "5"),
  retrievalStrategy: process.env.DANI_DOC_RETRIEVAL_STRATEGY ?? "speed",
  documentTag: process.env.DANI_DOCUMENT_TAG ?? "dani-core",
};
