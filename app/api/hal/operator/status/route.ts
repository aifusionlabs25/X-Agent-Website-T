import { NextResponse } from "next/server";
import { buildHalOperatorDashboardSnapshot } from "@/lib/xagent/halOperatorStore.mjs";

export async function GET() {
    try {
        return NextResponse.json(await buildHalOperatorDashboardSnapshot());
    } catch (err: unknown) {
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Failed to build Hal operator status",
                status: "operator_status_error",
                safe_status_only: true,
            },
            { status: 400 },
        );
    }
}
