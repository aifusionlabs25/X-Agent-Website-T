'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { Mail, ShieldCheck, Square, User } from 'lucide-react';
import DaniLiveNotesPanel from '@/components/dani/DaniLiveNotesPanel';
import DaniPostSessionResults from '@/components/dani/DaniPostSessionResults';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMORY_CHECKIN_ENABLED = process.env.NEXT_PUBLIC_XAGENT_EMAIL_MEMORY_CHECKIN_ENABLED !== 'false';

export default function TavusPlayer({ onClose }: Props) {
    const videoContainerRef = useRef<HTMLDivElement | null>(null);
    const callFrameRef = useRef<DailyCall | null>(null);
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
    const [showResults, setShowResults] = useState(false);
    const [emailActionStatus, setEmailActionStatus] = useState<EmailActionStatus | null>(null);
    const [endedAtLabel, setEndedAtLabel] = useState<string>('Just now');
    const sessionEndedRef = useRef(false);
    const sessionIdentityRef = useRef<{
        tenant_id: string;
        agent_slug: string;
        visitor_id: string;
        session_id: string;
        provider: string;
        provider_conversation_id: string;
        startedAt: number;
    } | null>(null);

    const lookupEmailActionStatus = useCallback(async (providerConversationId: string) => {
        try {
            const response = await fetch('/api/xagent/email-actions/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider_conversation_id: providerConversationId }),
            });
            const json = await response.json();
            if (response.ok && json?.safe_status_only) {
                setEmailActionStatus(json);
                return;
            }
        } catch {
            // Keep the post-session UI safe and pending if status lookup is unavailable.
        }

        setEmailActionStatus({
            email_action_status_available: false,
            email_action_plan_created: false,
            send_count: 0,
            memory_record_stored: false,
            action_claim_allowed: false,
        });
    }, []);

    const finishSession = useCallback(() => {
        if (sessionEndedRef.current) return;
        sessionEndedRef.current = true;

        const providerConversationId = sessionIdentityRef.current?.provider_conversation_id;
        const label = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            month: 'short',
            day: 'numeric',
        }).format(new Date());

        setEndedAtLabel(label);
        setLoading(false);
        setShowResults(true);

        const frame = callFrameRef.current;
        callFrameRef.current = null;
        if (frame) {
            try {
                frame.destroy();
            } catch {
                // Daily cleanup should never block the safe post-session screen.
            }
        }

        if (providerConversationId) {
            void lookupEmailActionStatus(providerConversationId);
        }
    }, [lookupEmailActionStatus]);

    const startFresh = () => {
        setFormError(null);
        setConversationStartFlags(null);
        setEmailActionStatus(null);
        sessionEndedRef.current = false;
        setLoading(true);
        setStartPayload({ skip_memory: true, memory_mode: 'fresh' });
    };

    const continueWithMemory = () => {
        const email = visitorEmail.trim().toLowerCase();
        const displayName = visitorName.trim();

        if (!EMAIL_PATTERN.test(email)) {
            setFormError('Enter a valid email or start fresh without memory.');
            return;
        }

        setFormError(null);
        setConversationStartFlags(null);
        setEmailActionStatus(null);
        sessionEndedRef.current = false;
        setLoading(true);
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
                // 1) Fetch new conversation URL securely from our backend route
                const hasPayload = Object.keys(startPayload ?? {}).length > 0;
                const res = await fetch('/api/conversation/start', {
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
                    throw new Error(json.error || 'Failed to start conversation');
                }

                if (!isMounted) return;

                const url = json.conversation_url;
                const container = videoContainerRef.current;

                if (!container || !url) return;

                setConversationUrl(url);
                setConversationStartFlags(pickSafeConversationStartExperienceFlags(json));
                sessionIdentityRef.current = {
                    tenant_id: json.tenant_id,
                    agent_slug: json.agent_slug,
                    visitor_id: json.visitor_id,
                    session_id: json.session_id,
                    provider: json.provider,
                    provider_conversation_id: json.provider_conversation_id,
                    startedAt: json.startedAt,
                };

                // 2) Mount the WebRTC Daily iframe directly to the DOM
                const callFrame = DailyIframe.createFrame(container, {
                    iframeStyle: {
                        width: '100%',
                        height: '100%',
                        border: '0',
                    },
                    // Anam doesn't use standard Daily UI; we just want the pure feed
                    showLeaveButton: false,
                    showFullscreenButton: false,
                });

                callFrameRef.current = callFrame;

                // 3) Listen for events so we can remove the loading screen
                callFrame.on('joined-meeting', () => {
                    if (isMounted) setLoading(false);
                });

                callFrame.on('error', (e) => {
                    console.error('[Daily] error:', e);
                    if (isMounted) {
                        setError('Meeting error occurred.');
                        setLoading(false);
                    }
                });

                callFrame.on('left-meeting', () => {
                    if (isMounted) finishSession();
                });

                // 4) Reveal the Daily/Tavus iframe before join so browser permission
                // prompts and Daily's connection UI are not hidden behind our overlay.
                setLoading(false);

                // 5) Join instantly! (prompts user for mic/camera permissions)
                await callFrame.join({ url });

            } catch (e: unknown) {
                if (isMounted) {
                    setError(e instanceof Error ? e.message : 'An unknown error occurred');
                    setLoading(false);
                }
            }
        }

        init();

        return () => {
            isMounted = false;
            if (callFrameRef.current) {
                // Must destroy properly or WebRTC streams will orphan
                callFrameRef.current.destroy();
                callFrameRef.current = null;
            }
        };
    }, [finishSession, startPayload]);

    return (
        <div className="absolute inset-0 w-full h-full bg-black z-[100] flex flex-col items-center justify-center">

            {/* Optional memory check-in before the Tavus room is created */}
            {startPayload === null && !error && (
                <div className="absolute inset-0 z-[103] flex items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.24),transparent_36%),linear-gradient(135deg,#050508_0%,#111116_48%,#050508_100%)] p-5">
                    <div className="w-full max-w-[520px] border border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/60 backdrop-blur-xl">
                        <div className="border-b border-white/10 px-6 py-5 sm:px-7">
                            <div className="mb-3 inline-flex items-center gap-2 border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-200">
                                <ShieldCheck size={14} />
                                Memory Check-In
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                Help Dani pick up where you left off.
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-zinc-300">
                                Share your email before the session if you want Dani to look for approved notes from past conversations. Skip this step to start fresh.
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
                                    className="w-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400"
                                    placeholder="What should Dani call you?"
                                    autoComplete="name"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                                    <Mail size={14} />
                                    Email for memory
                                </span>
                                <input
                                    value={visitorEmail}
                                    onChange={(event) => {
                                        setVisitorEmail(event.target.value);
                                        setFormError(null);
                                    }}
                                    className="w-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400"
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
                                    className="inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-black text-black transition-colors hover:bg-zinc-200"
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
                                No password is needed. If you skip, Dani will not retrieve prior conversation notes for this session.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Indicator */}
            {loading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-[102]">
                    <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                    <p className="text-white text-xl font-bold tracking-widest animate-pulse">STARTING ENGINE...</p>
                    <p className="text-zinc-500 mt-2 text-sm">Negotiating WebRTC stream & generating Dani AI matrix...</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-[102] p-6 text-center">
                    <p className="text-red-500 text-xl font-bold mb-4 w-full">Connection Failed</p>
                    <p className="text-zinc-400 mb-6">{error}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        {conversationUrl && (
                            <a
                                href={conversationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white hover:bg-zinc-200 text-black px-6 py-2 rounded-md font-semibold transition-colors"
                            >
                                Open Tavus Room
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-md font-semibold transition-colors flex items-center gap-2"
                        >
                            <Square size={16} className="fill-white" />
                            Cancel Sequence
                        </button>
                    </div>
                </div>
            )}

            {startPayload !== null && !error && !showResults && (
                <DaniLiveNotesPanel
                    displayName={visitorName}
                    memoryCheckInSupplied={Boolean(startPayload.email)}
                    freshSession={Boolean(startPayload.skip_memory)}
                    conversationStart={conversationStartFlags ?? undefined}
                    visible={!loading || Boolean(conversationStartFlags)}
                />
            )}

            {/* Daily Video Container (rendered once mounted) */}
            <div ref={videoContainerRef} className="w-full h-full" />

            {/* End Session Overlay Button (sits above the Daily feed) */}
            {!loading && !error && !showResults && (
                <div className="absolute bottom-8 left-8 md:bottom-16 md:left-16 z-[105]">
                    <button
                        onClick={finishSession}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-7 py-3 rounded-md text-sm transition-colors shadow-lg shadow-red-900/50"
                    >
                        <Square size={16} className="fill-white" />
                        End Session
                    </button>
                </div>
            )}

            {showResults && (
                <DaniPostSessionResults
                    emailActionStatus={emailActionStatus}
                    memoryContextApplied={Boolean(conversationStartFlags?.memoryApplied)}
                    endedAtLabel={endedAtLabel}
                    onClose={onClose}
                />
            )}
        </div>
    );
}
