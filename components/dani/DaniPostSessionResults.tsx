'use client';

import { useMemo } from 'react';
import { ArrowUpRight, Check, Clock, Download, MailCheck, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { buildDaniPostSessionResultsState } from '@/lib/xagent/daniSessionExperience.mjs';

type EmailActionStatus = {
    email_action_status_available?: boolean;
    email_action_plan_created?: boolean;
    email_action_plan_status?: string;
    action_count?: number;
    draft_count?: number;
    send_count?: number;
    action_types?: string[];
    sent_action_types?: string[];
    memory_record_stored?: boolean;
    action_claim_allowed?: boolean;
    agentmail_message_sent?: boolean;
};

type Props = {
    emailActionStatus?: EmailActionStatus | null;
    memoryContextApplied?: boolean;
    endedAtLabel?: string;
    onClose: () => void;
    onStartAnother?: () => void;
};

const toneClasses = {
    confirmed: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    active: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    pending: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    neutral: 'border-white/10 bg-white/5 text-zinc-200',
} as const;

const toneIcon = {
    confirmed: Check,
    active: ShieldCheck,
    pending: Clock,
    neutral: MailCheck,
} as const;

export default function DaniPostSessionResults({
    emailActionStatus,
    memoryContextApplied,
    endedAtLabel,
    onClose,
    onStartAnother,
}: Props) {
    const results = useMemo(
        () => buildDaniPostSessionResultsState({
            emailActionStatus: emailActionStatus ?? null,
            memoryContextApplied,
            endedAtLabel,
        }),
        [emailActionStatus, endedAtLabel, memoryContextApplied],
    );

    return (
        <div className="absolute inset-0 z-[108] flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,#050507_0%,#111018_48%,#050507_100%)] px-4 py-8 text-white">
            <div className="w-full max-w-4xl border border-white/12 bg-zinc-950/88 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <div className="relative border-b border-white/10 px-6 py-6 text-center sm:px-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Close session results"
                    >
                        <X size={17} />
                    </button>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                        <Check size={22} />
                    </div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Dani session complete</p>
                    <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{results.title}</h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{results.subtitle}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-500">{results.completedAt}</p>
                </div>

                <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
                    {results.statusCards.map((card) => {
                        const Icon = toneIcon[card.tone as keyof typeof toneIcon] ?? MailCheck;
                        return (
                            <section
                                key={card.label}
                                className={`border p-4 ${toneClasses[card.tone as keyof typeof toneClasses] ?? toneClasses.neutral}`}
                            >
                                <Icon size={19} className="mb-4" />
                                <h3 className="text-sm font-black tracking-tight">{card.label}</h3>
                                <p className="mt-2 text-xs leading-5 text-zinc-300">{card.detail}</p>
                            </section>
                        );
                    })}
                </div>

                <div className="grid gap-4 border-t border-white/10 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
                    <div className="border border-white/10 bg-white/[0.035] p-5">
                        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                            <ShieldCheck size={15} />
                            Confirmation Boundary
                        </div>
                        <p className="text-sm leading-6 text-zinc-200">{results.guidance}</p>
                        <p className="mt-3 text-sm leading-6 text-zinc-400">{results.continuationNote}</p>
                    </div>

                    <div className="grid gap-3">
                        {results.actions.map((action) => action.available ? (
                            <a
                                key={action.label}
                                href={action.href}
                                target={action.external ? '_blank' : undefined}
                                rel={action.external ? 'noopener noreferrer' : undefined}
                                className="flex items-center justify-between gap-4 bg-white px-4 py-3 text-sm font-black text-black transition-colors hover:bg-zinc-200"
                            >
                                <span>{action.label}</span>
                                <ArrowUpRight size={16} />
                            </a>
                        ) : (
                            <div
                                key={action.label}
                                className="flex items-start justify-between gap-4 border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-400"
                            >
                                <span>
                                    <span className="block font-bold text-zinc-200">{action.label}</span>
                                    <span className="mt-1 block text-xs leading-5">{action.unavailableReason}</span>
                                </span>
                                <Download size={16} className="mt-1 shrink-0" />
                            </div>
                        ))}

                        {onStartAnother && (
                            <button
                                type="button"
                                onClick={onStartAnother}
                                className="flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                            >
                                <RotateCcw size={16} />
                                Start another session
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
