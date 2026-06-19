import { NextResponse } from "next/server";
import { buildSessionCompletedFromTavusDryRun } from "@/lib/xagent/sessionCompletedFromTavus.mjs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return NextResponse.json(await buildSessionCompletedFromTavusDryRun(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build Tavus transcript dry-run payload",
                dry_run_only: true,
                hermes_dispatched: false,
                outbound_action_taken: false,
            },
            { status: 400 },
        );
    }
}
