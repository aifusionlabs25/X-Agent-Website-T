import { NextResponse } from "next/server";
import { createConversation } from "@/lib/tavus";

export async function POST(request: Request) {
    try {
        const startedAt = Date.now();

        // Dynamically build the webhook callback URL
        const host = request.headers.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const callbackUrl = host ? `${protocol}://${host}/api/webhook` : undefined;

        const data = await createConversation(callbackUrl);
        return NextResponse.json({
            ...data,
            startedAt,
        });
    } catch (err: unknown) {
        console.error("Error creating conversation:", err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create conversation" }, { status: 500 });
    }
}
