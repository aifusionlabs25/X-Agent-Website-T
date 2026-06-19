import { NextResponse } from "next/server";
import {
    assertTavusMemoryPromptPreviewGates,
    buildTavusMemoryPromptPreview,
} from "@/lib/xagent/tavusMemoryPromptPreview.mjs";

export async function POST(request: Request) {
    try {
        assertTavusMemoryPromptPreviewGates();
        const body = await request.json();
        return NextResponse.json(buildTavusMemoryPromptPreview(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build Tavus memory prompt preview",
                dry_run_only: true,
                prompt_preview_only: true,
                tavus_prompt_injection_performed: false,
                conversation_start_mutated: false,
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
