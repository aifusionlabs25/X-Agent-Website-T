import { NextResponse } from "next/server";
import { buildXAgentRuntimeReadiness } from "@/lib/xagent/runtimeReadiness.mjs";

export async function GET() {
    return NextResponse.json(buildXAgentRuntimeReadiness());
}
