const ENABLED_ENV = "XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

export function isEmailMemoryPreviewUiEnabled(overrides = {}) {
  return (overrides[ENABLED_ENV] ?? env(ENABLED_ENV)) === "true";
}

export function buildEmailMemoryPreviewUiGateStatus(overrides = {}) {
  const enabled = isEmailMemoryPreviewUiEnabled(overrides);
  return {
    email_memory_preview_ui_enabled: enabled,
    private_preview_only: true,
    public_button_flow_changed: false,
    tavus_create_conversation_called: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    production_memory_persistence_used: false,
    outbound_action_taken: false,
  };
}
