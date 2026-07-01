import Link from "next/link";
import {
    Activity,
    Archive,
    BrainCircuit,
    CheckCircle2,
    Clock3,
    FileText,
    Inbox,
    MailCheck,
    ShieldCheck,
    Sparkles,
    Waypoints,
} from "lucide-react";
import { buildHalOperatorDashboardSnapshot } from "@/lib/xagent/halOperatorStore.mjs";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Hal Operator Dashboard | AI Fusion Labs",
    description: "Safe operator dashboard for Hal session memory, briefs, action review, and receipts.",
};

type Snapshot = Awaited<ReturnType<typeof buildHalOperatorDashboardSnapshot>>;
type RecentSession = Snapshot["recent_sessions"][number];
type PendingAction = Snapshot["pending_actions"][number];
type Receipt = Snapshot["receipts"][number];

function formatDate(value?: string | null) {
    if (!value) return "Pending";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "Unknown";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function labelize(value?: string | null) {
    return String(value ?? "unknown").replace(/[._-]/g, " ");
}

function metricTone(index: number) {
    return [
        "border-[#d7b46a]/45 bg-[#19160f]",
        "border-[#7db6a4]/45 bg-[#0e1b18]",
        "border-[#9da6c8]/45 bg-[#111521]",
        "border-[#cf8e66]/45 bg-[#21130e]",
    ][index % 4];
}

function EmptyState() {
    return (
        <section className="border border-[#2b302b] bg-[#0e110d] p-8">
            <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7b46a]">Waiting for signal</p>
                <h2 className="mt-3 text-3xl font-black text-[#f6f1e6]">No Hal sessions have reached the operator store yet.</h2>
                <p className="mt-4 text-sm leading-6 text-[#aeb7ae]">
                    Run a Hal Tavus session from the live site, end it cleanly, and let the transcription webhook complete. This page will then show the safe memory write, post-session brief, queued actions, and receipts.
                </p>
            </div>
        </section>
    );
}

function SessionRow({ session }: { session: RecentSession }) {
    const brief = session.brief;
    return (
        <article className="border border-[#262b27] bg-[#0d100d] p-5 transition-colors hover:border-[#d7b46a]/50">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7db6a4]">
                        {formatDate(session.created_at)}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-[#f6f1e6]">{brief?.title ?? "Hal session"}</h3>
                </div>
                <span className="border border-[#374236] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#cfd9c8]">
                    {session.memory_record_stored ? "Memory Stored" : "No Memory Write"}
                </span>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-[#bcc5ba]">{brief?.tl_dr ?? "No post-session brief was stored."}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="border-l border-[#d7b46a]/50 pl-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d9689]">Turns</p>
                    <p className="mt-1 text-lg font-black text-white">{session.turn_count}</p>
                </div>
                <div className="border-l border-[#7db6a4]/50 pl-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d9689]">Email Sends</p>
                    <p className="mt-1 text-lg font-black text-white">{session.email_actions?.send_count ?? 0}</p>
                </div>
                <div className="border-l border-[#cf8e66]/50 pl-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d9689]">Brief Signals</p>
                    <p className="mt-1 text-sm font-bold text-white">{brief?.signals?.join(", ") || "none"}</p>
                </div>
            </div>
        </article>
    );
}

function ActionRow({ action }: { action: PendingAction }) {
    return (
        <article className="border border-[#302d23] bg-[#14120d] p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d7b46a]">{labelize(action.action_type)}</p>
                    <h3 className="mt-2 text-base font-black text-[#f6f1e6]">{action.subject_preview || "Review item"}</h3>
                </div>
                <span className="border border-[#d7b46a]/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#efd996]">
                    Review
                </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#aeb7ae]">
                Completion claim is blocked until a tool receipt or human approval exists.
            </p>
        </article>
    );
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
    const completed = receipt.status === "completed";
    return (
        <article className="grid gap-3 border-b border-[#222923] py-4 last:border-b-0 sm:grid-cols-[1fr_auto]">
            <div>
                <p className="text-sm font-black text-[#f6f1e6]">{labelize(receipt.capability)}</p>
                <p className="mt-1 text-xs text-[#8f9c91]">{receipt.provider_conversation_id}</p>
            </div>
            <div className="flex items-center gap-2 text-right">
                {completed ? <CheckCircle2 size={16} className="text-[#7be6b6]" /> : <Clock3 size={16} className="text-[#d7b46a]" />}
                <span className={completed ? "text-sm font-black text-[#7be6b6]" : "text-sm font-black text-[#efd996]"}>
                    {labelize(receipt.status)}
                </span>
            </div>
        </article>
    );
}

export default async function HalOperatorPage() {
    let snapshot: Snapshot;
    try {
        snapshot = await buildHalOperatorDashboardSnapshot({ limit: 12 });
    } catch (error) {
        snapshot = {
            schema_version: "hal_operator_v1",
            artifact_purpose: "hal_operator_dashboard_snapshot",
            tenant_id: "ai-fusion-labs",
            agent_slug: "hal",
            status: "operator_status_error",
            generated_at: new Date().toISOString(),
            metrics: {
                recent_session_count: 0,
                memory_write_count: 0,
                sent_email_count: 0,
                pending_action_count: 0,
                claim_safe_receipt_count: 0,
            },
            recent_sessions: [],
            pending_actions: [],
            receipts: [],
            prep_briefs: [],
            safety: {
                raw_email_returned: false,
                raw_transcript_returned: false,
                secret_returned: false,
            },
            error: error instanceof Error ? error.message : "Unknown error",
        } as Snapshot;
    }

    const metrics = [
        { label: "Recent Sessions", value: snapshot.metrics.recent_session_count, icon: Activity },
        { label: "Memory Writes", value: snapshot.metrics.memory_write_count, icon: BrainCircuit },
        { label: "Emails Sent", value: snapshot.metrics.sent_email_count, icon: MailCheck },
        { label: "Pending Review", value: snapshot.metrics.pending_action_count, icon: Inbox },
    ];

    return (
        <main className="min-h-screen bg-[#080a08] text-[#f6f1e6]">
            <section
                className="border-b border-[#252a25] px-5 py-8 sm:px-8 lg:px-12"
                style={{
                    backgroundImage:
                        "linear-gradient(135deg, rgba(215,180,106,0.12), transparent 34%), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 84px)",
                }}
            >
                <nav className="flex flex-wrap items-center justify-between gap-4">
                    <Link href="/hal" className="text-xs font-black uppercase tracking-[0.22em] text-[#d7b46a]">
                        Hal Live
                    </Link>
                    <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#9fa89c]">
                        <ShieldCheck size={16} className="text-[#7be6b6]" />
                        No raw email or transcript returned
                    </div>
                </nav>

                <div className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#7db6a4]">One Hal, many users</p>
                        <h1 className="mt-4 max-w-4xl text-[clamp(3.2rem,8vw,8.5rem)] font-black leading-[0.86] tracking-normal">
                            Operator
                            <span className="block text-[#d7b46a]">Autopilot</span>
                        </h1>
                    </div>
                    <div className="border-l border-[#d7b46a]/45 pl-6">
                        <p className="text-sm leading-7 text-[#c8d1c3]">
                            A safe Hermes cockpit for Hal continuity: session artifacts, memory graph signal, post-session briefs, review queues, and tool receipts. Hal can only claim completion when a receipt says the action happened.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {["memory isolated by user", "public-source safe", "action receipts required"].map((item) => (
                                <span key={item} className="border border-[#343b33] bg-[#0b0f0c] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#dce5d8]">
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-5 py-8 sm:px-8 lg:px-12">
                <div className="grid gap-4 md:grid-cols-4">
                    {metrics.map((metric, index) => {
                        const Icon = metric.icon;
                        return (
                            <article key={metric.label} className={`border p-5 ${metricTone(index)}`}>
                                <Icon size={22} className="text-[#f0cf86]" />
                                <p className="mt-6 text-4xl font-black text-white">{metric.value}</p>
                                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#b9c3b4]">{metric.label}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="grid gap-6 px-5 pb-12 sm:px-8 lg:grid-cols-[1.35fr_0.65fr] lg:px-12">
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[#262b27] pb-4">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7b46a]">Session Artifacts</p>
                            <h2 className="mt-2 text-3xl font-black text-white">Recent Hal Runs</h2>
                        </div>
                        <Archive className="text-[#7db6a4]" />
                    </div>
                    {snapshot.recent_sessions.length > 0
                        ? snapshot.recent_sessions.map((session) => (
                            <SessionRow key={session.provider_conversation_id} session={session} />
                        ))
                        : <EmptyState />}
                </div>

                <aside className="space-y-6">
                    <section className="border border-[#2b302b] bg-[#0d100d] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#cf8e66]">Review Queue</p>
                                <h2 className="mt-2 text-2xl font-black text-white">Human Gate</h2>
                            </div>
                            <Waypoints className="text-[#cf8e66]" />
                        </div>
                        <div className="mt-5 space-y-3">
                            {snapshot.pending_actions.length > 0
                                ? snapshot.pending_actions.map((action) => (
                                    <ActionRow key={action.queue_item_id} action={action} />
                                ))
                                : (
                                    <p className="border border-[#222923] p-4 text-sm leading-6 text-[#aeb7ae]">
                                        No pending Hal actions require operator review right now.
                                    </p>
                                )}
                        </div>
                    </section>

                    <section className="border border-[#2b302b] bg-[#0d100d] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7db6a4]">Receipts</p>
                                <h2 className="mt-2 text-2xl font-black text-white">Claim Ledger</h2>
                            </div>
                            <FileText className="text-[#7db6a4]" />
                        </div>
                        <div className="mt-4">
                            {snapshot.receipts.length > 0
                                ? snapshot.receipts.map((receipt) => (
                                    <ReceiptRow key={receipt.receipt_id} receipt={receipt} />
                                ))
                                : (
                                    <p className="border border-[#222923] p-4 text-sm leading-6 text-[#aeb7ae]">
                                        No receipts have been written yet.
                                    </p>
                                )}
                        </div>
                    </section>

                    <section className="border border-[#2b302b] bg-[#14120d] p-5">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-[#d7b46a]" />
                            <h2 className="text-xl font-black text-white">Meeting Prep Lane</h2>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[#b9c3b4]">
                            Prepared but secondary: Hal can build a briefing from supplied meeting context, but most live visitors start unannounced. This stays useful without becoming the center of the product.
                        </p>
                    </section>
                </aside>
            </section>
        </main>
    );
}
