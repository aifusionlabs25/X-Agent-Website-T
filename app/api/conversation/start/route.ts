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
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const callbackUrl = host ? `${protocol}://${host}/api/webhook` : undefined;

        let memoryContext: ConversationStartMemoryContext = buildNoMemoryConversationStartContext();
        if (areConversationStartMemoryContextGatesOpen()) {
            try {
                const requestBody = await readOptionalJsonBody(request);
                memoryContext = buildConversationStartMemoryContextForRequestBody(requestBody);
                memoryContext = await maybeResolveServerSideMemoryContextForStart(requestBody) ?? memoryContext;
            } catch {
                console.warn("Rejected invalid conversation-start memory context before Tavus createConversation.");
                return NextResponse.json(
                    buildInvalidMemoryContextValidationResponse(),
                    { status: 400 },
                );
            }
        }

        const data = await createConversation(callbackUrl, {
            conversationalContext: memoryContext.conversationalContext,
        });
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
