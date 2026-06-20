"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Play, RotateCcw, ShieldCheck } from "lucide-react";

type SafeDryRunResult = {
    return_code_supplied?: boolean;
    return_code_valid?: boolean;
    memory_context_requested?: boolean;
    server_side_memory_lookup_attempted?: boolean;
    server_side_memory_context_applied?: boolean;
    tavus_conversational_context_attached?: boolean;
    tavus_create_conversation_called?: boolean;
};

const RETURN_CODE_PATTERN = /^DANI-RET-[A-HJ-NP-TV-Z2-9]{4}-[A-HJ-NP-TV-Z2-9]{4}-[A-HJ-NP-TV-Z2-9]{4}$/i;
const SAFE_FIELDS: Array<keyof SafeDryRunResult> = [
    "return_code_supplied",
    "return_code_valid",
    "memory_context_requested",
    "server_side_memory_lookup_attempted",
    "server_side_memory_context_applied",
    "tavus_conversational_context_attached",
    "tavus_create_conversation_called",
];

function normalizeReturnCode(value: string) {
    const compact = value.trim().toUpperCase().replace(/[\s-]/g, "");
    if (!compact.startsWith("DANIRET")) return value.trim().toUpperCase();
    const suffix = compact.slice("DANIRET".length);
    return `DANI-RET-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}-${suffix.slice(8, 12)}`;
}

function pickSafeResult(value: unknown): SafeDryRunResult {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const result: SafeDryRunResult = {};
    for (const field of SAFE_FIELDS) {
        result[field] = Boolean(source[field]);
    }
    result.tavus_create_conversation_called = false;
    return result;
}

export default function ReturnCodePreviewClient() {
    const [returnCode, setReturnCode] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [safeResult, setSafeResult] = useState<SafeDryRunResult | null>(null);
    const [message, setMessage] = useState("");

    const normalizedCode = useMemo(() => normalizeReturnCode(returnCode), [returnCode]);
    const formatValid = RETURN_CODE_PATTERN.test(normalizedCode);

    async function runDryRun(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSafeResult(null);
        setMessage("");

        if (!formatValid) {
            setStatus("error");
            setMessage("Return code format is not valid.");
            return;
        }

        setStatus("loading");
        try {
            const response = await fetch("/api/xagent/return-code-conversation-start/dry-run", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ return_code: normalizedCode }),
            });
            const json = await response.json().catch(() => ({}));
            const safe = pickSafeResult(json);
            setSafeResult(safe);
            setStatus(response.ok ? "success" : "error");
            setMessage(response.ok ? "Dry-run accepted." : "Dry-run rejected safely.");
        } catch {
            setStatus("error");
            setMessage("Dry-run request failed before any live start.");
        }
    }

    function reset() {
        setReturnCode("");
        setSafeResult(null);
        setStatus("idle");
        setMessage("");
    }

    return (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
            <form onSubmit={runDryRun} className="rounded-md border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Return code check</h2>
                        <p className="text-sm text-zinc-400">Private dry-run only</p>
                    </div>
                </div>

                <label htmlFor="return-code" className="mt-5 block text-sm font-medium text-zinc-300">
                    Return code
                </label>
                <input
                    id="return-code"
                    value={returnCode}
                    onChange={(event) => setReturnCode(event.target.value)}
                    placeholder="DANI-RET-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-400"
                />

                <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-400">
                    <div className="flex items-center justify-between gap-3">
                        <span>format_valid</span>
                        <span className={formatValid ? "text-emerald-300" : "text-zinc-500"}>{String(formatValid)}</span>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                        {status === "loading" ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} className="fill-zinc-950" />}
                        Dry run
                    </button>
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                    >
                        <RotateCcw size={16} />
                        Reset
                    </button>
                </div>
            </form>

            <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Safe status</h2>
                        <p className="text-sm text-zinc-400">No conversation is created here</p>
                    </div>
                    <div className="rounded-md border border-zinc-700 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300">
                        {status}
                    </div>
                </div>

                {message ? <p className="mt-4 text-sm text-zinc-300">{message}</p> : null}

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    {SAFE_FIELDS.map((field) => {
                        const value = safeResult?.[field] ?? false;
                        return (
                            <div key={field} className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                                <dt className="min-h-8 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">{field}</dt>
                                <dd className={value ? "mt-2 font-mono text-lg text-emerald-300" : "mt-2 font-mono text-lg text-zinc-400"}>
                                    {String(value)}
                                </dd>
                            </div>
                        );
                    })}
                </dl>

                <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 text-sm text-zinc-400 sm:grid-cols-2">
                    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">start route</span>
                        <p className="mt-2 text-zinc-300">not called</p>
                    </div>
                    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">room url</span>
                        <p className="mt-2 text-zinc-300">not displayed</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
