import { NextResponse } from "next/server";
import {
    buildReturnCodeConversationStartDryRunResponse,
    buildSafeReturnCodeConversationStartDryRunRejectedResponse,
} from "@/lib/xagent/returnCodeConversationStartDryRun.mjs";

export async function POST(request: Request) {
    let body: Record<string, unknown> = {};
    try {
        const parsedBody = await request.json();
        body =
            parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
                ? (parsedBody as Record<string, unknown>)
                : {};
        return NextResponse.json(await buildReturnCodeConversationStartDryRunResponse(body));
    } catch {
        return NextResponse.json(
            buildSafeReturnCodeConversationStartDryRunRejectedResponse(body),
            { status: 400 },
        );
    }
}
