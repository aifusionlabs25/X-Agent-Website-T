'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, MailCheck, NotebookPen, ShieldCheck } from 'lucide-react';
import { buildDaniLiveNotesState } from '@/lib/xagent/daniSessionExperience.mjs';

type ConversationStartFlags = {
    memoryRequested?: boolean;
    memoryApplied?: boolean;
    contextAttached?: boolean;
};

type Props = {
    displayName?: string;
    memoryCheckInSupplied?: boolean;
    freshSession?: boolean;
    conversationStart?: ConversationStartFlags;
    visible?: boolean;
};

const chipTone = {
    active: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    confirmed: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
    pending: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
    neutral: 'border-white/10 bg-white/5 text-zinc-300',
} as const;

export default function DaniLiveNotesPanel({
    displayName,
    memoryCheckInSupplied,
    freshSession,
    conversationStart,
    visible = true,
}: Props) {
    const [expanded, setExpanded] = useState(true);
    const notes = useMemo(
        () => buildDaniLiveNotesState({
            displayName,
            memoryCheckInSupplied,
            freshSession,
            conversationStart,
        }),
        [conversationStart, displayName, freshSession, memoryCheckInSupplied],
    );

    if (!visible) return null;

    return (
        <aside className="pointer-events-auto absolute right-3 top-3 z-[106] w-[min(92vw,390px)] text-white md:right-5 md:top-5">
            <div className="overflow-hidden border border-white/12 bg-zinc-950/82 shadow-2xl shadow-black/55 backdrop-blur-xl">
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="flex w-full items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                    aria-expanded={expanded}
                >
                    <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                            <NotebookPen size={17} />
                        </span>
                        <span>
                            <span className="block text-sm font-black tracking-tight">{notes.title}</span>
                            <span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-zinc-500">Live session cues</span>
                        </span>
                    </span>
                    <ChevronDown
                        size={17}
                        className={`shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                </button>

                {expanded && (
                    <div className="max-h-[calc(100vh-150px)] overflow-y-auto px-4 py-4">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {notes.statusChips.map((chip) => (
                                <span
                                    key={chip.label}
                                    className={`border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${chipTone[chip.status as keyof typeof chipTone] ?? chipTone.neutral}`}
                                >
                                    {chip.label}
                                </span>
                            ))}
                        </div>

                        <div className="space-y-3">
                            {notes.rows.map((row) => (
                                <div key={row.label} className="grid grid-cols-[112px_1fr] gap-3 border-b border-white/[0.07] pb-2 last:border-b-0">
                                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{row.label}</dt>
                                    <dd className="text-sm leading-5 text-zinc-100">{row.value}</dd>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 border border-white/10 bg-white/[0.035] p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
                                <ClipboardList size={14} />
                                Open Questions
                            </div>
                            <ul className="space-y-2 text-sm leading-5 text-zinc-200">
                                {notes.openQuestions.map((question) => (
                                    <li key={question} className="flex gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-cyan-300" />
                                        <span>{question}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-4 grid gap-2 text-xs leading-5 text-zinc-400">
                            <p className="flex gap-2">
                                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                                <span>{notes.footer}</span>
                            </p>
                            <p className="flex gap-2">
                                <MailCheck size={14} className="mt-0.5 shrink-0 text-amber-200" />
                                <span>{notes.subtitle}</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
