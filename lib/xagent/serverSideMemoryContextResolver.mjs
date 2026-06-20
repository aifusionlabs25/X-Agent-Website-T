import defaultMemoryContextFixture from "../../tests/fixtures/hermes-next-session-context-preview-dani.json" with { type: "json" };
import {
  areConversationStartMemoryContextGatesOpen,
  buildNoMemoryConversationStartContext,
  buildConversationStartMemoryContextForRequestBody,
  hasSuppliedConversationStartMemoryContext,
} from "./conversationStartMemoryContext.mjs";
import {
  areEmailMemoryLookupGatesOpen,
  resolveEmailMemoryContext,
} from "./emailIdentityMemoryLookup.mjs";
import {
  areEmailMemoryStoreGatesOpen,
  readStoredEmailMemoryContext,
} from "./emailMemoryStore.mjs";
import {
  areReturnCodeMemoryLookupGatesOpen,
  resolveReturnCodeMemoryContext,
} from "./returnCodeMemoryLookup.mjs";

const ENABLED_ENV = "XAGENT_NORMAL_SITE_MEMORY_LOOKUP_ENABLED";
const DANI_PILOT_ENV = "XAGENT_DANI_NORMAL_SITE_MEMORY_LOOKUP_PILOT_ENABLED";
const KILL_SWITCH_ENV = "XAGENT_NORMAL_SITE_MEMORY_LOOKUP_KILL_SWITCH";

function env(key) {
  return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function readGateConfig(overrides = {}) {
  return {
    enabled: overrides[ENABLED_ENV] ?? env(ENABLED_ENV),
    daniPilotEnabled: overrides[DANI_PILOT_ENV] ?? env(DANI_PILOT_ENV),
    killSwitch: overrides[KILL_SWITCH_ENV] ?? env(KILL_SWITCH_ENV),
  };
}

export function areServerSideMemoryContextResolverGatesOpen(overrides = {}) {
  const gates = readGateConfig(overrides);
  return (
    areConversationStartMemoryContextGatesOpen(overrides)
    && gates.enabled === "true"
    && gates.daniPilotEnabled === "true"
    && gates.killSwitch === "false"
  );
}

export function loadServerSideMemoryContextFixture(options = {}) {
  return JSON.parse(JSON.stringify(options.memoryContext ?? defaultMemoryContextFixture));
}

function getSuppliedReturnCode(body) {
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

function getSuppliedEmail(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  if (typeof body.email === "string" && body.email.trim()) {
    return body.email;
  }
  if (typeof body.returning_email === "string" && body.returning_email.trim()) {
    return body.returning_email;
  }
  if (typeof body.returningEmail === "string" && body.returningEmail.trim()) {
    return body.returningEmail;
  }
  return undefined;
}

function isFreshStartRequested(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  return body.skip_memory === true || body.memory_mode === "fresh";
}

export async function maybeResolveServerSideMemoryContextForStart(body, options = {}) {
  const envSource = options.env ?? process.env;

  if (hasSuppliedConversationStartMemoryContext(body)) {
    return undefined;
  }

  if (isFreshStartRequested(body)) {
    return {
      ...buildNoMemoryConversationStartContext(),
      server_side_memory_context_resolved: false,
      server_side_memory_context_source: "fresh_start_requested",
    };
  }

  const suppliedReturnCode = getSuppliedReturnCode(body);
  if (suppliedReturnCode) {
    if (!areReturnCodeMemoryLookupGatesOpen(envSource)) {
      return undefined;
    }

    const returnCodeLookup = resolveReturnCodeMemoryContext(
      { return_code: suppliedReturnCode },
      { fixture: options.returnCodeFixture },
    );

    return {
      ...buildConversationStartMemoryContextForRequestBody(
        { memory_context: returnCodeLookup.memory_context },
        { env: envSource },
      ),
      server_side_memory_context_resolved: true,
      server_side_memory_context_source: "return_code_local_fixture",
      return_code_memory_lookup_used: true,
    };
  }

  const suppliedEmail = getSuppliedEmail(body);
  if (suppliedEmail) {
    if (areEmailMemoryStoreGatesOpen(envSource)) {
      const storedEmailMemory = await readStoredEmailMemoryContext(
        {
          email: suppliedEmail,
          nextSessionId: options.nextSessionId,
        },
        {
          env: envSource,
          fetchImpl: options.fetchImpl,
          identitySalt: options.emailIdentitySalt,
          upstashUrl: options.upstashUrl,
          upstashToken: options.upstashToken,
        },
      );

      if (storedEmailMemory) {
        return {
          ...buildConversationStartMemoryContextForRequestBody(
            { memory_context: storedEmailMemory.memory_context },
            { env: envSource },
          ),
          server_side_memory_context_resolved: true,
          server_side_memory_context_source: "email_identity_memory_store",
          email_identity_memory_lookup_used: true,
        };
      }
    }

    if (!areEmailMemoryLookupGatesOpen(envSource)) {
      return undefined;
    }

    let emailLookup;
    try {
      emailLookup = resolveEmailMemoryContext(
        { email: suppliedEmail },
        {
          fixture: options.emailMemoryFixture,
          identitySalt: options.emailIdentitySalt,
        },
      );
    } catch (error) {
      if (error instanceof Error && /email identity was not found/.test(error.message)) {
        return {
          ...buildNoMemoryConversationStartContext(),
          server_side_memory_context_resolved: false,
          server_side_memory_context_source: "email_identity_no_approved_memory_found",
          email_identity_memory_lookup_used: false,
        };
      }
      throw error;
    }

    return {
      ...buildConversationStartMemoryContextForRequestBody(
        { memory_context: emailLookup.memory_context },
        { env: envSource },
      ),
      server_side_memory_context_resolved: true,
      server_side_memory_context_source: "email_identity_local_fixture",
      email_identity_memory_lookup_used: true,
    };
  }

  if (!areServerSideMemoryContextResolverGatesOpen(envSource)) {
    return undefined;
  }

  const memoryContext = loadServerSideMemoryContextFixture(options);
  return {
    ...buildConversationStartMemoryContextForRequestBody(
      { memory_context: memoryContext },
      { env: envSource },
    ),
    server_side_memory_context_resolved: true,
    server_side_memory_context_source: "local_fixture",
  };
}
