import { cfg } from "./config";
import { buildCreateConversationBody } from "./tavusCreateConversationBody.mjs";

export async function createConversationWithConfig(
    agentConfig: typeof cfg,
    callbackUrl?: string,
    options?: { conversationalContext?: string },
) {
    const body = buildCreateConversationBody(agentConfig, {
        callbackUrl,
        conversationalContext: options?.conversationalContext,
    });

    const res = await fetch("https://tavusapi.com/v2/conversations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": agentConfig.tavusApiKey,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Tavus createConversation failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<{ conversation_url: string; conversation_id: string }>;
}

export async function createConversation(
    callbackUrl?: string,
    options?: { conversationalContext?: string },
) {
    return createConversationWithConfig(cfg, callbackUrl, options);
}
