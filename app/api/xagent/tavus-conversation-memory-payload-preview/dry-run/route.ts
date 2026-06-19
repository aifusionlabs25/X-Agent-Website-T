import { NextResponse } from "next/server";
import {
    assertTavusConversationMemoryPayloadPreviewGates,
    buildTavusConversationStartMemoryPayloadPreview,
} from "@/lib/xagent/tavusConversationStartMemoryPreview.mjs";

export async function POST(request: Request) {
    try {
        assertTavusConversationMemoryPayloadPreviewGates();
        const body = await request.json();
        return NextResponse.json(buildTavusConversationStartMemoryPayloadPreview(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build Tavus conversation memory payload preview",
                dry_run_only: true,
                payload_preview_only: true,
                tavus_create_conversation_called: false,
                conversation_start_route_mutated: false,
                tavus_prompt_injection_performed: false,
                live_tavus_called: false,
                live_hermes_called: false,
                openai_called: false,
                ollama_generate_called: false,
                resend_called: false,
                production_database_mutated: false,
                outbound_action_taken: false,
            },
            { status: 400 },
        );
    }
}
