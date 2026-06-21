import { NextResponse } from "next/server";
import { buildHermesEmailActionStatusLookup } from "@/lib/xagent/hermesEmailActionStatusStore.mjs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return NextResponse.json(await buildHermesEmailActionStatusLookup(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to check Hermes email action status",
                email_action_status_checked: false,
                email_action_status_available: false,
                safe_status_only: true,
            },
            { status: 400 },
        );
    }
}
