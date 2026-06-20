import { NextResponse } from "next/server";
import {
    areEmailMemoryLookupGatesOpen,
    buildGatedEmailMemoryLookupDryRunResponse,
    buildSafeEmailMemoryLookupUnavailableResponse,
} from "@/lib/xagent/emailIdentityMemoryLookup.mjs";

export async function POST(request: Request) {
    let body: Record<string, unknown> = {};
    try {
        const parsedBody = await request.json();
        body =
            parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
                ? (parsedBody as Record<string, unknown>)
                : {};
        return NextResponse.json(buildGatedEmailMemoryLookupDryRunResponse(body));
    } catch {
        return NextResponse.json(
            buildSafeEmailMemoryLookupUnavailableResponse(body, {
                emailMemoryLookupPreviewEnabled: areEmailMemoryLookupGatesOpen(),
            }),
            { status: 400 },
        );
    }
}
