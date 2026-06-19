import { areConversationStartMemoryContextGatesOpen } from "./conversationStartMemoryContext.mjs";
import {
  areReturnCodeMemoryLookupGatesOpen,
  normalizeDaniReturnCode,
} from "./returnCodeMemoryLookup.mjs";
import { maybeResolveServerSideMemoryContextForStart } from "./serverSideMemoryContextResolver.mjs";
import { DANI_AGENT_SLUG, DANI_TENANT_ID } from "./sessionIdentity.mjs";

function getReturnCode(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  if (typeof body.return_code === "string" && body.return_code.trim()) {
    return body.return_code;
  }
  if (typeof body.returnCode === "string" && body.returnCode.trim()) {
    return body.returnCode;
  }
  return undefined;
}

function safeBaseResponse(overrides = {}) {
  return {
    dry_run_only: true,
    internal_route_only: true,
    return_code_conversation_start_dry_run: true,
    return_code_supplied: Boolean(overrides.return_code_supplied),
    return_code_valid: Boolean(overrides.return_code_valid),
    agent_slug: DANI_AGENT_SLUG,
    tenant_id: DANI_TENANT_ID,
    memory_injection_gates_open: Boolean(overrides.memory_injection_gates_open),
    return_code_memory_lookup_gates_open: Boolean(overrides.return_code_memory_lookup_gates_open),
    memory_context_requested: Boolean(overrides.memory_context_requested),
    memory_context_applied: false,
    server_side_memory_lookup_attempted: Boolean(overrides.server_side_memory_lookup_attempted),
    server_side_memory_context_applied: Boolean(overrides.server_side_memory_context_applied),
    tavus_conversational_context_attached: Boolean(overrides.tavus_conversational_context_attached),
    tavus_create_conversation_called: false,
    live_tavus_called: false,
    live_hermes_called: false,
    openai_called: false,
    codex_openai_escalation: false,
    ollama_generate_called: false,
    resend_called: false,
    production_database_mutated: false,
    production_memory_database_mutated: false,
    outbound_action_taken: false,
  };
}

export function buildSafeReturnCodeConversationStartDryRunRejectedResponse(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  return safeBaseResponse({
    return_code_supplied: Boolean(getReturnCode(input)),
    return_code_valid: false,
    memory_injection_gates_open: areConversationStartMemoryContextGatesOpen(envSource),
    return_code_memory_lookup_gates_open: areReturnCodeMemoryLookupGatesOpen(envSource),
    memory_context_requested: Boolean(getReturnCode(input)),
    server_side_memory_lookup_attempted: false,
    server_side_memory_context_applied: false,
    tavus_conversational_context_attached: false,
  });
}

export async function buildReturnCodeConversationStartDryRunResponse(input = {}, options = {}) {
  const envSource = options.env ?? process.env;
  const returnCode = getReturnCode(input);
  const returnCodeSupplied = Boolean(returnCode);
  const memoryInjectionGatesOpen = areConversationStartMemoryContextGatesOpen(envSource);
  const returnCodeGatesOpen = areReturnCodeMemoryLookupGatesOpen(envSource);

  if (!returnCodeSupplied) {
    throw new Error("return_code is required");
  }
  if (!memoryInjectionGatesOpen) {
    throw new Error("memory injection gates must be open for return-code conversation-start dry-run");
  }
  if (!returnCodeGatesOpen) {
    throw new Error("return-code memory lookup gates must be open for conversation-start dry-run");
  }

  normalizeDaniReturnCode(returnCode);
  const resolved = await maybeResolveServerSideMemoryContextForStart(
    { return_code: returnCode },
    {
      env: envSource,
      returnCodeFixture: options.returnCodeFixture,
    },
  );

  if (!resolved?.memory_context_applied || !resolved?.tavus_conversational_context_attached) {
    throw new Error("return-code memory context was not resolved");
  }

  return safeBaseResponse({
    return_code_supplied: true,
    return_code_valid: true,
    memory_injection_gates_open: true,
    return_code_memory_lookup_gates_open: true,
    memory_context_requested: true,
    server_side_memory_lookup_attempted: true,
    server_side_memory_context_applied: true,
    tavus_conversational_context_attached: true,
  });
}
