'use client';

import { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { AgentData } from '@/components/home/AgentThumbnail';
import { motion, AnimatePresence } from 'framer-motion';
import TavusPlayer from '@/components/TavusPlayer';

interface Props {
    agent: AgentData;
}

export default function AgentDemoButton({ agent }: Props) {
    const [isPlaying, setIsPlaying] = useState(false);

    // Dani uses the inline Tavus player instead of an external demo URL.
    if (agent.slug === 'dani') {
        return (
            <>
                <button
                    onClick={() => setIsPlaying(true)}
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-black font-bold px-4 py-2 md:py-2.5 rounded-md transition-colors text-xs md:text-sm w-full shadow-lg"
                >
                    <Play size={16} className="fill-black" />
                    Launch Live Demo
                </button>

                {/* Tavus Streaming Layer — fixed to viewport */}
                <AnimatePresence>
                    {isPlaying && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="fixed inset-0 z-50 pointer-events-auto"
                        >
                            <TavusPlayer onClose={() => setIsPlaying(false)} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // Standard redirect for other isolated Tavus specific agent hubs
    if (agent.liveUrl) {
        return (
            <a
                href={agent.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-black font-bold px-4 py-2 md:py-2.5 rounded-md transition-colors text-xs md:text-sm w-full shadow-lg"
            >
                <ExternalLink size={16} />
                Launch Live Demo
            </a>
        );
    }

    // Fallback for missing URLs (Luna)
    return (
        <div className="inline-flex items-center justify-center gap-2 bg-zinc-800/80 text-zinc-400 px-4 py-2 md:py-2.5 rounded-md cursor-not-allowed text-xs md:text-sm w-full backdrop-blur-sm shadow-lg border border-zinc-700">
            Coming Soon
        </div>
    );
}
