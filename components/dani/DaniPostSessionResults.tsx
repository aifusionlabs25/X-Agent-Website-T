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
    confirmed: 'border-white/10 bg-white/[0.045] text-emerald-200',
    active: 'border-white/10 bg-white/[0.045] text-cyan-200',
    pending: 'border-white/10 bg-white/[0.045] text-amber-200',
    neutral: 'border-white/10 bg-white/[0.045] text-zinc-200',
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
        <div className="absolute inset-0 z-[108] flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.13),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.09),transparent_28%),linear-gradient(135deg,#050507_0%,#101014_52%,#050507_100%)] px-4 py-7 text-white">
            <div className="w-full max-w-5xl overflow-hidden border border-white/12 bg-zinc-950/90 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <div className="relative grid gap-6 border-b border-white/10 px-6 py-6 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Close session results"
                    >
                        <X size={17} />
                    </button>
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
                            <Check size={14} />
                            Session wrap-up
                        </div>
                        <h2 className="max-w-xl text-2xl font-black tracking-tight sm:text-3xl">{results.title}</h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">{results.subtitle}</p>
                    </div>
                    <div className="border border-white/10 bg-white/[0.035] p-4 lg:mr-10">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Completed</div>
                        <p className="mt-2 text-lg font-bold text-zinc-100">{results.completedAt}</p>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">
                            Backend actions stay marked pending until their status is confirmed.
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
                    {results.statusCards.map((card) => {
                        const Icon = toneIcon[card.tone as keyof typeof toneIcon] ?? MailCheck;
                        return (
                            <section
                                key={card.label}
                                className={`relative overflow-hidden border p-4 ${toneClasses[card.tone as keyof typeof toneClasses] ?? toneClasses.neutral}`}
                            >
                                <span className="absolute inset-y-0 left-0 w-1 bg-current opacity-60" />
                                <Icon size={18} className="mb-3" />
                                <h3 className="text-sm font-black tracking-tight">{card.label}</h3>
                                <p className="mt-2 text-xs leading-5 text-zinc-400">{card.detail}</p>
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
