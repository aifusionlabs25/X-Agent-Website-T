import { cfg } from "./config";
import { buildCreateConversationBody } from "./tavusCreateConversationBody.mjs";

export async function createConversation(
    callbackUrl?: string,
    options?: { conversationalContext?: string },
) {
    const body = buildCreateConversationBody(cfg, {
        callbackUrl,
        conversationalContext: options?.conversationalContext,
    });

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
