import { NextResponse } from "next/server";
import { storeHalMeetingPrepBrief } from "@/lib/xagent/halOperatorStore.mjs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return NextResponse.json(await storeHalMeetingPrepBrief(body));
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build Hal meeting prep brief",
                stored: false,
                outbound_action_taken: false,
                safe_status_only: true,
            },
            { status: 400 },
        );
    }
}
