import { NextResponse } from "next/server";
import { createConversation } from "@/lib/tavus";
import { buildDaniConversationStartResponse, createDaniSessionIdentity } from "@/lib/xagent/sessionIdentity.mjs";
import {
    areConversationStartMemoryContextGatesOpen,
    buildConversationStartMemoryContextForRequestBody,
    buildInvalidMemoryContextValidationResponse,
    buildNoMemoryConversationStartContext,
    readOptionalJsonBody,
    safeConversationStartMemoryFlags,
} from "@/lib/xagent/conversationStartMemoryContext.mjs";
import { maybeResolveServerSideMemoryContextForStart } from "@/lib/xagent/serverSideMemoryContextResolver.mjs";
import { storeConversationEmailMappingForStart } from "@/lib/xagent/emailMemoryStore.mjs";

function env(key: string) {
    return process.env[key]?.replace(/^\uFEFF/, "").trim() ?? "";
}

function buildCallbackUrl(host: string | null) {
    if (!host) return undefined;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}/api/webhook`;
    const callbackToken = env("XAGENT_TAVUS_CALLBACK_TOKEN");
    if (!callbackToken) return baseUrl;
    const url = new URL(baseUrl);
    url.searchParams.set("token", callbackToken);
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
        const identity = createDaniSessionIdentity();

        // Dynamically build the webhook callback URL
        const host = request.headers.get('host');
        const callbackUrl = buildCallbackUrl(host);
        const requestBody = await readOptionalJsonBody(request);

        let memoryContext: ConversationStartMemoryContext = buildNoMemoryConversationStartContext();
        if (areConversationStartMemoryContextGatesOpen()) {
            try {
                memoryContext = buildConversationStartMemoryContextForRequestBody(requestBody);
            } catch {
                console.warn("Rejected invalid conversation-start memory context before Tavus createConversation.");
                return NextResponse.json(
                    buildInvalidMemoryContextValidationResponse(),
                    { status: 400 },
                );
            }

            try {
                memoryContext = await maybeResolveServerSideMemoryContextForStart(
                    requestBody,
                    { nextSessionId: identity.session_id },
                ) ?? memoryContext;
            } catch (memoryLookupError) {
                console.warn("Server-side memory lookup was unavailable; starting without memory context.", memoryLookupError);
            }
        }

        const data = await createConversation(callbackUrl, {
            conversationalContext: memoryContext.conversationalContext,
        });
        try {
            await storeConversationEmailMappingForStart({
                requestBody,
                session_id: identity.session_id,
                provider_conversation_id: data.conversation_id,
                started_at: startedAt,
            });
        } catch (mappingError) {
            console.warn("Email memory mapping was not stored for conversation start.", mappingError);
        }

        return NextResponse.json({
            ...buildDaniConversationStartResponse(data, startedAt, identity),
            ...safeConversationStartMemoryFlags(memoryContext),
        });
    } catch (err: unknown) {
        console.error("Error creating conversation:", err);
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to create conversation",
                memory_context_requested: false,
                memory_context_applied: false,
                tavus_conversational_context_attached: false,
            },
            { status: 500 },
        );
    }
}
