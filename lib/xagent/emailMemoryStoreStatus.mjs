import { isBasicEmailIdentityShape } from "./emailIdentityMemoryLookup.mjs";
import { readStoredEmailMemoryContext } from "./emailMemoryStore.mjs";

export async function buildEmailMemoryStoreStatus(input = {}, options = {}) {
  const email = typeof input.email === "string" ? input.email.trim() : "";

  if (!email || !isBasicEmailIdentityShape(email)) {
    return {
      email_supplied: Boolean(email),
      email_valid: false,
      memory_store_checked: false,
      memory_context_available: false,
      safe_status_only: true,
    };
  }

  const storedMemory = await readStoredEmailMemoryContext(
    {
      email,
      nextSessionId: "xagent_session_status_probe",
    },
    options,
  );

  return {
    email_supplied: true,
    email_valid: true,
    memory_store_checked: true,
    memory_context_available: Boolean(storedMemory),
    lookup_source: storedMemory?.lookup_source ?? "none",
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    outbound_action_taken: false,
    production_database_mutated: false,
    safe_status_only: true,
  };
}
