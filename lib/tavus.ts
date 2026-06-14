import { cfg } from "./config";

export async function createConversation(callbackUrl?: string) {
    const body: Record<string, unknown> = {
        persona_id: cfg.personaId,
        replica_id: cfg.replicaId,
        custom_greeting:
            "Hey, welcome. I am Dani. Thanks for dropping in. What are you most curious about today.",
        callback_url: callbackUrl,
        // KB fields temporarily disabled — re-enable once Tavus confirms docs are indexed
        // document_tags: [cfg.documentTag],
        // document_retrieval_strategy: "speed",
        properties: {
            max_call_duration: cfg.maxCallSeconds,
            participant_absent_timeout: cfg.absentTimeout,
            participant_left_timeout: cfg.leftTimeout,
        },
    };

    const res = await fetch("https://tavusapi.com/v2/conversations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": cfg.tavusApiKey,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Tavus createConversation failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<{ conversation_url: string; conversation_id: string }>;
}
