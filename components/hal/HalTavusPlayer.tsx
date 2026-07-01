'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { ExternalLink, Mail, ShieldCheck, Square, User } from 'lucide-react';
import { pickSafeConversationStartExperienceFlags } from '@/lib/xagent/daniSessionExperience.mjs';

interface Props {
    onClose: () => void;
}

type ConversationStartPayload = {
    email?: string;
    display_name?: string;
    skip_memory?: true;
    memory_mode?: 'fresh';
};

type ConversationStartFlags = {
    memoryRequested?: boolean;
    memoryApplied?: boolean;
    contextAttached?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMORY_CHECKIN_ENABLED = process.env.NEXT_PUBLIC_XAGENT_EMAIL_MEMORY_CHECKIN_ENABLED !== 'false';

export default function HalTavusPlayer({ onClose }: Props) {
    const videoContainerRef = useRef<HTMLDivElement | null>(null);
    const callFrameRef = useRef<DailyCall | null>(null);
    const sessionEndedRef = useRef(false);
    const hasJoinedMeetingRef = useRef(false);
    const [startPayload, setStartPayload] = useState<ConversationStartPayload | null>(
        MEMORY_CHECKIN_ENABLED ? null : {},
    );
    const [loading, setLoading] = useState(!MEMORY_CHECKIN_ENABLED);
    const [error, setError] = useState<string | null>(null);
    const [conversationUrl, setConversationUrl] = useState<string | null>(null);
    const [visitorName, setVisitorName] = useState('');
    const [visitorEmail, setVisitorEmail] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [conversationStartFlags, setConversationStartFlags] = useState<ConversationStartFlags | null>(null);
    const [sessionConnected, setSessionConnected] = useState(false);
    const [sessionEnded, setSessionEnded] = useState(false);

    const finishSession = useCallback(() => {
        if (sessionEndedRef.current) return;
        sessionEndedRef.current = true;
        setLoading(false);
        setSessionConnected(false);
        setSessionEnded(true);

        const frame = callFrameRef.current;
        callFrameRef.current = null;
        if (frame) {
            try {
                frame.destroy();
            } catch {
                // Daily cleanup should never block the safe post-session screen.
            }
        }
    }, []);

    const resetForStart = () => {
        setFormError(null);
        setConversationStartFlags(null);
        setSessionEnded(false);
        sessionEndedRef.current = false;
        hasJoinedMeetingRef.current = false;
        setSessionConnected(false);
        setLoading(true);
    };

    const startFresh = () => {
        resetForStart();
        setStartPayload({ skip_memory: true, memory_mode: 'fresh' });
    };

    const continueWithMemory = () => {
        const email = visitorEmail.trim().toLowerCase();
        const displayName = visitorName.trim();

        if (!EMAIL_PATTERN.test(email)) {
            setFormError('Enter a valid email or start fresh without memory.');
            return;
        }

        resetForStart();
        setStartPayload({
            email,
            ...(displayName ? { display_name: displayName } : {}),
        });
    };

    useEffect(() => {
        if (startPayload === null) return;

        let isMounted = true;

        async function init() {
            try {
                hasJoinedMeetingRef.current = false;
                setSessionConnected(false);

                const hasPayload = Object.keys(startPayload ?? {}).length > 0;
                const res = await fetch('/api/hal/conversation/start', {
                    method: 'POST',
                    ...(hasPayload
                        ? {
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(startPayload),
                        }
                        : {}),
                });
                const json = await res.json();

                if (!res.ok) {
                    throw new Error(json.error || 'Failed to start Hal conversation');
                }

                if (!isMounted) return;

                const url = json.conversation_url;
                const container = videoContainerRef.current;
                if (!container || !url) return;

                setConversationUrl(url);
                setConversationStartFlags(pickSafeConversationStartExperienceFlags(json));

                const callFrame = DailyIframe.createFrame(container, {
                    iframeStyle: {
                        width: '100%',
                        height: '100%',
                        border: '0',
                    },
                    showLeaveButton: false,
                    showFullscreenButton: false,
                });

                callFrameRef.current = callFrame;

                callFrame.on('joined-meeting', () => {
                    hasJoinedMeetingRef.current = true;
                    if (isMounted) {
                        setSessionConnected(true);
                        setLoading(false);
                    }
                });

                callFrame.on('error', (event) => {
                    console.error('[Daily/Hal] error:', event);
                    if (isMounted) {
                        setError('Meeting error occurred.');
                        setLoading(false);
                    }
                });

                callFrame.on('left-meeting', () => {
                    if (!hasJoinedMeetingRef.current) return;
                    if (isMounted) finishSession();
                });

                setLoading(false);
                await callFrame.join({ url });
            } catch (event: unknown) {
                if (isMounted) {
                    setError(event instanceof Error ? event.message : 'An unknown error occurred');
                    setLoading(false);
                }
            }
        }

        init();

        return () => {
            isMounted = false;
            if (callFrameRef.current) {
                callFrameRef.current.destroy();
                callFrameRef.current = null;
            }
        };
    }, [finishSession, startPayload]);

    return (
        <div className="fixed inset-0 z-[9999] isolate flex h-dvh w-screen flex-col items-center justify-center bg-black">
            {startPayload === null && !error && (
                <div className="absolute inset-0 z-[103] flex items-center justify-center bg-[#070806] p-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(214,181,109,0.22),transparent_34%)]" />
                    <div className="relative w-full max-w-[540px] border border-[#d6b56d]/25 bg-[#10110e]/95 shadow-2xl shadow-black/60">
                        <div className="border-b border-white/10 px-6 py-5 sm:px-7">
                            <div className="mb-3 inline-flex items-center gap-2 border border-[#d6b56d]/35 bg-[#d6b56d]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#f3d68c]">
                                <ShieldCheck size={14} />
                                Memory Check-In
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                Start a Hal session.
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-zinc-300">
                                Share your email if you want Hal to look for approved notes from prior Hal conversations. Start fresh to skip memory.
                            </p>
                        </div>

                        <div className="space-y-4 px-6 py-5 sm:px-7">
                            <label className="block">
                                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                                    <User size={14} />
                                    Name optional
                                </span>
                                <input
                                    value={visitorName}
                                    onChange={(event) => setVisitorName(event.target.value)}
                                    className="w-full border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#d6b56d]"
                                    placeholder="What should Hal call you?"
                                    autoComplete="name"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                                    <Mail size={14} />
                                    Email for Hal memory
                                </span>
                                <input
                                    value={visitorEmail}
                                    onChange={(event) => {
                                        setVisitorEmail(event.target.value);
                                        setFormError(null);
                                    }}
                                    className="w-full border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#d6b56d]"
                                    placeholder="you@company.com"
                                    autoComplete="email"
                                    inputMode="email"
                                />
                            </label>

                            {formError && (
                                <p className="border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                    {formError}
                                </p>
                            )}

                            <div className="grid gap-3 pt-2 sm:grid-cols-2">
                                <button
                                    onClick={continueWithMemory}
                                    className="inline-flex items-center justify-center gap-2 bg-[#d6b56d] px-5 py-3 text-sm font-black text-black transition-colors hover:bg-[#f0cf86]"
                                >
                                    <Mail size={16} />
                                    Continue with memory
                                </button>
                                <button
                                    onClick={startFresh}
                                    className="inline-flex items-center justify-center border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                                >
                                    Start fresh
                                </button>
                            </div>

                            <p className="text-xs leading-5 text-zinc-500">
                                Hal is a prototype AI operating partner interface. It is not Brian Halligan and does not claim completed actions without backend confirmation.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {loading && !error && (
                <div className="absolute inset-0 z-[102] flex flex-col items-center justify-center bg-zinc-950">
                    <div className="mb-6 h-16 w-16 animate-spin border-4 border-[#d6b56d]/20 border-t-[#d6b56d] shadow-[0_0_15px_rgba(214,181,109,0.45)]" />
                    <p className="text-xl font-bold tracking-[0.22em] text-white">STARTING HAL</p>
                    <p className="mt-2 text-sm text-zinc-500">Opening Tavus room...</p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 z-[102] flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
                    <p className="mb-4 w-full text-xl font-bold text-red-500">Connection Failed</p>
                    <p className="mb-6 max-w-[520px] text-zinc-400">{error}</p>
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {conversationUrl && (
                            <a
                                href={conversationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-white px-6 py-2 font-semibold text-black transition-colors hover:bg-zinc-200"
                            >
                                Open Tavus Room
                                <ExternalLink size={15} />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="inline-flex items-center gap-2 bg-zinc-800 px-6 py-2 font-semibold text-white transition-colors hover:bg-zinc-700"
                        >
                            <Square size={16} className="fill-white" />
                            Close
                        </button>
                    </div>
                </div>
            )}

            {sessionEnded && !error && (
                <div className="absolute inset-0 z-[102] flex items-center justify-center bg-[#070806] p-5 text-center">
                    <div className="w-full max-w-[560px] border border-[#d6b56d]/25 bg-[#10110e]/95 p-7">
                        <div className="mb-3 inline-flex items-center gap-2 border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                            <ShieldCheck size={14} />
                            Session ended safely
                        </div>
                        <h2 className="text-3xl font-black text-white">Thanks for speaking with Hal.</h2>
                        <p className="mt-4 text-sm leading-6 text-zinc-300">
                            If you used email memory, Hal can use approved notes on a future visit after the session transcript callback is processed.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-6 bg-[#d6b56d] px-6 py-3 text-sm font-black text-black transition-colors hover:bg-[#f0cf86]"
                        >
                            Return to Hal
                        </button>
                    </div>
                </div>
            )}

            <div ref={videoContainerRef} className="h-full w-full" />

            {conversationStartFlags && !loading && !error && !sessionEnded && (
                <div className="pointer-events-none absolute left-5 top-5 z-[105] flex flex-wrap gap-2">
                    <span className="border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
                        Hal live
                    </span>
                    <span className="border border-[#d6b56d]/25 bg-black/55 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f3d68c] backdrop-blur">
                        {conversationStartFlags.memoryApplied ? 'Memory ready' : 'Fresh context'}
                    </span>
                </div>
            )}

            {sessionConnected && !loading && !error && !sessionEnded && (
                <div className="absolute bottom-8 left-8 z-[105] md:bottom-16 md:left-16">
                    <button
                        onClick={finishSession}
                        className="flex items-center gap-2 bg-red-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/50 transition-colors hover:bg-red-500"
                    >
                        <Square size={16} className="fill-white" />
                        End Session
                    </button>
                </div>
            )}
        </div>
    );
}
