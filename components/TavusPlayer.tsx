'use client';

import { useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { Square } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function TavusPlayer({ onClose }: Props) {
    const videoContainerRef = useRef<HTMLDivElement | null>(null);
    const callFrameRef = useRef<DailyCall | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [conversationUrl, setConversationUrl] = useState<string | null>(null);
    const sessionIdentityRef = useRef<{
        tenant_id: string;
        agent_slug: string;
        visitor_id: string;
        session_id: string;
        provider: string;
        provider_conversation_id: string;
        startedAt: number;
    } | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function init() {
            try {
                // 1) Fetch new conversation URL securely from our backend route
                const res = await fetch('/api/conversation/start', { method: 'POST' });
                const json = await res.json();

                if (!res.ok) {
                    throw new Error(json.error || 'Failed to start conversation');
                }

                if (!isMounted) return;

                const url = json.conversation_url;
                const container = videoContainerRef.current;

                if (!container || !url) return;

                setConversationUrl(url);
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
                    onClose();
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
    }, [onClose]);

    return (
        <div className="absolute inset-0 w-full h-full bg-black z-[100] flex flex-col items-center justify-center">

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

            {/* Daily Video Container (rendered once mounted) */}
            <div ref={videoContainerRef} className="w-full h-full" />

            {/* End Session Overlay Button (sits above the Daily feed) */}
            {!loading && !error && (
                <div className="absolute bottom-8 left-8 md:bottom-16 md:left-16 z-[105]">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-7 py-3 rounded-md text-sm transition-colors shadow-lg shadow-red-900/50"
                    >
                        <Square size={16} className="fill-white" />
                        End Session
                    </button>
                </div>
            )}
        </div>
    );
}
