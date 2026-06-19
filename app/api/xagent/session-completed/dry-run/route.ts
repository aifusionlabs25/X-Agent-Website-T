import { NextResponse } from "next/server";
import { buildDryRunResponse } from "@/lib/xagent/sessionCompletedPayload.mjs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return NextResponse.json(buildDryRunResponse(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build dry-run session-completed payload",
                dry_run_only: true,
                hermes_dispatched: false,
                outbound_action_taken: false,
            },
            { status: 400 },
        );
    }
}
