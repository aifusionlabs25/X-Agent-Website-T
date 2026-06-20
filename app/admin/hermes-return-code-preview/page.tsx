import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import ReturnCodePreviewClient from "./ReturnCodePreviewClient";
import { buildReturnCodePreviewUiGateStatus } from "@/lib/xagent/returnCodePreviewUi.mjs";

export const dynamic = "force-dynamic";

export default function HermesReturnCodePreviewPage() {
    const gateStatus = buildReturnCodePreviewUiGateStatus();

    return (
        <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white sm:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
                <Link href="/admin/tavus" className="inline-flex w-fit items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white">
                    <ArrowLeft size={18} />
                    Admin Tavus
                </Link>

                <header className="grid gap-5 border-b border-zinc-800 pb-8 lg:grid-cols-[1fr_340px] lg:items-end">
                    <div>
                        <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-emerald-300">Hermes return-code preview</p>
                        <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                            Returning-user memory gate
                        </h1>
                    </div>
                    <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
                        <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Route boundary</div>
                        <div className="mt-2 text-sm text-zinc-300">Dry-run validation only</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                            <span>/api/xagent</span>
                            <span className="text-right text-emerald-300">No Tavus create</span>
                            <span>Public button</span>
                            <span className="text-right text-zinc-300">Unchanged</span>
                        </div>
                    </div>
                </header>

                {gateStatus.return_code_preview_ui_enabled ? (
                    <ReturnCodePreviewClient />
                ) : (
                    <section className="rounded-md border border-amber-500/30 bg-amber-500/10 p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-400/40 bg-zinc-950 text-amber-200">
                                <ShieldOff size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-amber-100">Preview UI disabled</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/80">
                                    Set XAGENT_RETURN_CODE_PREVIEW_UI_ENABLED=true for an operator-only dry-run surface. This page does not call the dry-run route while disabled.
                                </p>
                                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                    {Object.entries(gateStatus).map(([key, value]) => (
                                        <div key={key} className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                                            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{key}</dt>
                                            <dd className={value ? "mt-2 font-mono text-emerald-300" : "mt-2 font-mono text-zinc-300"}>{String(value)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
