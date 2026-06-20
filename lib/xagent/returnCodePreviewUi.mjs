const ENABLED_ENV = "XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

export function isReturnCodePreviewUiEnabled(overrides = {}) {
  return (overrides[ENABLED_ENV] ?? env(ENABLED_ENV)) === "true";
}

export function buildReturnCodePreviewUiGateStatus(overrides = {}) {
  const enabled = isReturnCodePreviewUiEnabled(overrides);
  return {
    return_code_preview_ui_enabled: enabled,
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
