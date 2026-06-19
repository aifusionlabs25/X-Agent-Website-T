import { NextResponse } from "next/server";
import {
    areReturnCodeMemoryLookupGatesOpen,
    buildGatedReturnCodeMemoryLookupDryRunResponse,
    buildSafeReturnCodeMemoryLookupUnavailableResponse,
} from "@/lib/xagent/returnCodeMemoryLookup.mjs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return NextResponse.json(buildGatedReturnCodeMemoryLookupDryRunResponse(body));
    } catch {
        return NextResponse.json(
            buildSafeReturnCodeMemoryLookupUnavailableResponse({
                returnCodeLookupPreviewEnabled: areReturnCodeMemoryLookupGatesOpen(),
            }),
            { status: 400 },
        );
    }
}
