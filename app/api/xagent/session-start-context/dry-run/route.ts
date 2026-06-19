import { NextResponse } from "next/server";
import {
    assertMemoryContextPreviewGates,
    buildSessionStartMemoryContextPreview,
} from "@/lib/xagent/sessionMemoryContext.mjs";

export async function POST(request: Request) {
    try {
        assertMemoryContextPreviewGates();
        const body = await request.json();
        return NextResponse.json(buildSessionStartMemoryContextPreview(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build session-start memory context preview",
                dry_run_only: true,
                memory_context_preview_enabled: false,
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
