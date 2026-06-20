import { NextResponse } from "next/server";
import { buildEmailMemoryStoreStatus } from "@/lib/xagent/emailMemoryStoreStatus.mjs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return NextResponse.json(await buildEmailMemoryStoreStatus(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to check email memory store status",
                memory_store_checked: false,
                memory_context_available: false,
                safe_status_only: true,
            },
            { status: 400 },
        );
    }
}
