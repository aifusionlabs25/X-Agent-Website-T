import { NextResponse } from "next/server";
import { handleTavusTranscriptionMemoryWebhook } from "@/lib/xagent/tavusTranscriptionMemoryWebhook.mjs";

export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const body = await request.json();
        const result = await handleTavusTranscriptionMemoryWebhook(body, {
            callbackToken: url.searchParams.get("token") ?? undefined,
        });
        return NextResponse.json(result);
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to process Tavus callback",
                memory_record_stored: false,
                live_tavus_called: false,
                live_hermes_called: false,
                openai_called: false,
                ollama_generate_called: false,
                resend_called: false,
                outbound_action_taken: false,
            },
            { status: 400 },
        );
    }
}
