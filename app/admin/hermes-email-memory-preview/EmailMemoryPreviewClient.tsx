"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Play, RotateCcw, ShieldCheck } from "lucide-react";

type SafeDryRunResult = {
    email_supplied?: boolean;
    email_valid?: boolean;
    email_identity_hash_derived?: boolean;
    memory_context_preview_available?: boolean;
    server_side_memory_context_applied?: boolean;
    tavus_create_conversation_called?: boolean;
    production_database_mutated?: boolean;
    live_tavus_called?: boolean;
    live_hermes_called?: boolean;
    outbound_action_taken?: boolean;
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_FIELDS: Array<keyof SafeDryRunResult> = [
    "email_supplied",
    "email_valid",
    "email_identity_hash_derived",
    "memory_context_preview_available",
    "server_side_memory_context_applied",
    "tavus_create_conversation_called",
    "production_database_mutated",
    "live_tavus_called",
    "live_hermes_called",
    "outbound_action_taken",
];

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function pickSafeResult(value: unknown): SafeDryRunResult {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const result: SafeDryRunResult = {};
    for (const field of SAFE_FIELDS) {
        result[field] = Boolean(source[field]);
    }
    result.tavus_create_conversation_called = false;
    result.server_side_memory_context_applied = false;
    return result;
}

export default function EmailMemoryPreviewClient() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [safeResult, setSafeResult] = useState<SafeDryRunResult | null>(null);
    const [message, setMessage] = useState("");

    const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
    const formatValid = EMAIL_SHAPE.test(normalizedEmail);

    async function runDryRun(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSafeResult(null);
        setMessage("");

        if (!formatValid) {
            setStatus("error");
            setMessage("Email format is not valid.");
            setEmail("");
            return;
        }

        setStatus("loading");
        try {
            const response = await fetch("/api/xagent/email-memory-lookup/dry-run", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email: normalizedEmail }),
            });
            const json = await response.json().catch(() => ({}));
            const safe = pickSafeResult(json);
            setSafeResult(safe);
            setStatus(response.ok ? "success" : "error");
            setMessage(response.ok ? "Dry-run accepted." : "Dry-run rejected safely.");
        } catch {
            setStatus("error");
            setMessage("Dry-run request failed before any live start.");
        } finally {
            setEmail("");
        }
    }

    function reset() {
        setEmail("");
        setSafeResult(null);
        setStatus("idle");
        setMessage("");
    }

    return (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
            <form onSubmit={runDryRun} className="rounded-md border border-neutral-800 bg-neutral-900/75 p-5">
                <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Email identity check</h2>
                        <p className="text-sm text-neutral-400">Private dry-run only</p>
                    </div>
                </div>

                <label htmlFor="email-identity" className="mt-5 block text-sm font-medium text-neutral-300">
                    Email
                </label>
                <input
                    id="email-identity"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter email for dry-run lookup"
                    autoComplete="off"
                    inputMode="email"
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-cyan-300"
                />

                <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-400">
                    <div className="flex items-center justify-between gap-3">
                        <span>format_valid</span>
                        <span className={formatValid ? "text-cyan-300" : "text-neutral-500"}>{String(formatValid)}</span>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-bold text-neutral-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                    >
                        {status === "loading" ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} className="fill-neutral-950" />}
                        Dry run
                    </button>
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-neutral-700 px-4 text-sm font-semibold text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                        <RotateCcw size={16} />
                        Reset
                    </button>
                </div>
            </form>

            <div className="rounded-md border border-neutral-800 bg-neutral-900/75 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Safe status</h2>
                        <p className="text-sm text-neutral-400">Email is not displayed after submit</p>
                    </div>
                    <div className="rounded-md border border-neutral-700 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-neutral-300">
                        {status}
                    </div>
                </div>

                {message ? <p className="mt-4 text-sm text-neutral-300">{message}</p> : null}

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    {SAFE_FIELDS.map((field) => {
                        const value = safeResult?.[field] ?? false;
                        return (
                            <div key={field} className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
                                <dt className="min-h-8 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">{field}</dt>
                                <dd className={value ? "mt-2 font-mono text-lg text-cyan-300" : "mt-2 font-mono text-lg text-neutral-400"}>
                                    {String(value)}
                                </dd>
                            </div>
                        );
                    })}
                </dl>

                <div className="mt-5 grid gap-3 border-t border-neutral-800 pt-5 text-sm text-neutral-400 sm:grid-cols-2">
                    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-500">start route</span>
                        <p className="mt-2 text-neutral-300">not called</p>
                    </div>
                    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-500">email sent</span>
                        <p className="mt-2 text-neutral-300">never</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
