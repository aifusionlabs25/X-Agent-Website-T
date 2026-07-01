import { NextResponse } from "next/server";
import { tavusConfigForAgent } from "@/lib/config";
import { createConversationWithConfig } from "@/lib/tavus";
import {
    HAL_AGENT_SLUG,
    buildXAgentConversationStartResponse,
    createXAgentSessionIdentity,
} from "@/lib/xagent/sessionIdentity.mjs";
import {
    areConversationStartMemoryContextGatesOpen,
    buildConversationStartMemoryContextForRequestBody,
    buildInvalidMemoryContextValidationResponse,
    buildNoMemoryConversationStartContext,
    readOptionalJsonBody,
    safeConversationStartMemoryFlags,
} from "@/lib/xagent/conversationStartMemoryContext.mjs";
import { storeConversationEmailMappingForStart } from "@/lib/xagent/emailMemoryStore.mjs";
import { maybeResolveServerSideMemoryContextForStart } from "@/lib/xagent/serverSideMemoryContextResolver.mjs";

const HAL_AGENT_NAME = "Hal";

function env(key: string) {
    return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function buildCallbackUrl(host: string | null) {
    if (!host) return undefined;
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const baseUrl = `${protocol}://${host}/api/webhook`;
    const url = new URL(baseUrl);
    url.searchParams.set("agent", HAL_AGENT_SLUG);

    const callbackToken = env("XAGENT_TAVUS_CALLBACK_TOKEN");
    if (callbackToken) {
        url.searchParams.set("token", callbackToken);
    }

    return url.toString();
}

type ConversationStartMemoryContext = {
    memory_context_requested: boolean;
    memory_context_applied: boolean;
    tavus_conversational_context_attached: boolean;
    conversationalContext?: string;
};

export async function POST(request: Request) {
    try {
        const startedAt = Date.now();
        const identity = createXAgentSessionIdentity({ agentSlug: HAL_AGENT_SLUG });
        const host = request.headers.get("host");
        const callbackUrl = buildCallbackUrl(host);
        const requestBody = await readOptionalJsonBody(request);

        let memoryContext: ConversationStartMemoryContext = buildNoMemoryConversationStartContext();
        if (areConversationStartMemoryContextGatesOpen()) {
            try {
                memoryContext = buildConversationStartMemoryContextForRequestBody(requestBody, {
                    agentSlug: HAL_AGENT_SLUG,
                    agentName: HAL_AGENT_NAME,
                });
            } catch {
                console.warn("Rejected invalid Hal conversation-start memory context before Tavus createConversation.");
                return NextResponse.json(
                    buildInvalidMemoryContextValidationResponse(),
                    { status: 400 },
                );
            }

            try {
                memoryContext = await maybeResolveServerSideMemoryContextForStart(
                    requestBody,
                    {
                        nextSessionId: identity.session_id,
                        agentSlug: HAL_AGENT_SLUG,
                        agentName: HAL_AGENT_NAME,
                    },
                ) ?? memoryContext;
            } catch (memoryLookupError) {
                console.warn("Hal server-side memory lookup was unavailable; starting without memory context.", memoryLookupError);
            }
        }

        const halTavusConfig = tavusConfigForAgent(HAL_AGENT_SLUG);
        const missingHalTavusConfig = [
            !halTavusConfig.tavusApiKey ? "TAVUS_API_KEY" : "",
            !halTavusConfig.personaId ? "HAL_TAVUS_PERSONA_ID" : "",
            !halTavusConfig.replicaId ? "HAL_TAVUS_REPLICA_ID" : "",
        ].filter(Boolean);

        if (missingHalTavusConfig.length > 0) {
            return NextResponse.json(
                {
                    error: `Hal Tavus configuration is missing: ${missingHalTavusConfig.join(", ")}`,
                    agent_slug: HAL_AGENT_SLUG,
                    missing_tavus_config: missingHalTavusConfig,
                    memory_context_requested: false,
                    memory_context_applied: false,
                    tavus_conversational_context_attached: false,
                },
                { status: 500 },
            );
        }

        const data = await createConversationWithConfig(halTavusConfig, callbackUrl, {
            conversationalContext: memoryContext.conversationalContext,
        });

        try {
            await storeConversationEmailMappingForStart({
                requestBody,
                session_id: identity.session_id,
                provider_conversation_id: data.conversation_id,
                started_at: startedAt,
            }, {
                agentSlug: HAL_AGENT_SLUG,
            });
        } catch (mappingError) {
            console.warn("Hal email memory mapping was not stored for conversation start.", mappingError);
        }

        return NextResponse.json({
            ...buildXAgentConversationStartResponse(data, startedAt, identity),
            ...safeConversationStartMemoryFlags(memoryContext),
            hal_public_demo_lane: true,
            outbound_action_taken: false,
            live_agentmail_called: false,
        });
    } catch (err: unknown) {
        console.error("Error creating Hal conversation:", err);
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to create Hal conversation",
                agent_slug: HAL_AGENT_SLUG,
                memory_context_requested: false,
                memory_context_applied: false,
                tavus_conversational_context_attached: false,
            },
            { status: 500 },
        );
    }
}
