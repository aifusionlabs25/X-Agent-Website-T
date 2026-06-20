import Link from "next/link";
import { ArrowLeft, MailCheck, ShieldOff } from "lucide-react";
import EmailMemoryPreviewClient from "./EmailMemoryPreviewClient";
import { buildEmailMemoryPreviewUiGateStatus } from "@/lib/xagent/emailMemoryPreviewUi.mjs";

export const dynamic = "force-dynamic";

export default function HermesEmailMemoryPreviewPage() {
    const gateStatus = buildEmailMemoryPreviewUiGateStatus();

    return (
        <main className="min-h-screen bg-neutral-950 px-5 py-8 text-white sm:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
                <Link href="/admin/tavus" className="inline-flex w-fit items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white">
                    <ArrowLeft size={18} />
                    Admin Tavus
                </Link>

                <header className="grid gap-5 border-b border-neutral-800 pb-8 lg:grid-cols-[1fr_360px] lg:items-end">
                    <div>
                        <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-cyan-300">Hermes email memory preview</p>
                        <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                            Email identity recall gate
                        </h1>
                    </div>
                    <div className="rounded-md border border-neutral-800 bg-neutral-900/75 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                                <MailCheck size={20} />
                            </div>
                            <div>
                                <div className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">Route boundary</div>
                                <div className="mt-1 text-sm text-neutral-300">Fixture dry-run validation only</div>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                            <span>/api/xagent</span>
                            <span className="text-right text-cyan-300">No Tavus create</span>
                            <span>Email sent</span>
                            <span className="text-right text-neutral-300">Never</span>
                        </div>
                    </div>
                </header>

                {gateStatus.email_memory_preview_ui_enabled ? (
                    <EmailMemoryPreviewClient />
                ) : (
                    <section className="rounded-md border border-amber-500/30 bg-amber-500/10 p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-400/40 bg-neutral-950 text-amber-200">
                                <ShieldOff size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-amber-100">Preview UI disabled</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/80">
                                    Set XAGENT_EMAIL_MEMORY_PREVIEW_UI_ENABLED=true for an operator-only email identity dry-run surface. This page does not call the dry-run route while disabled.
                                </p>
                                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                    {Object.entries(gateStatus).map(([key, value]) => (
                                        <div key={key} className="rounded-md border border-neutral-800 bg-neutral-950/70 p-3">
                                            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{key}</dt>
                                            <dd className={value ? "mt-2 font-mono text-cyan-300" : "mt-2 font-mono text-neutral-300"}>{String(value)}</dd>
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
