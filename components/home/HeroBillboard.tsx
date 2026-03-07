'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, ArrowRight } from 'lucide-react';
import GhostlyBackground from './GhostlyBackground';
import TavusPlayer from '@/components/TavusPlayer';
import { ALL_AGENTS } from '@/lib/agents';

export default function HeroBillboard() {
    const daniAgent = ALL_AGENTS.find((a) => a.slug === 'dani');
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <section className="relative w-full h-screen min-h-[540px] overflow-hidden bg-zinc-950">
            <GhostlyBackground />

            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
                {/* Hero image */}
                <Image
                    src="/agents/hero/dani-hero-wide.jpg"
                    alt="Dani – X Agent"
                    fill
                    priority
                    className="object-cover object-top"
                    sizes="100vw"
                />

                {/* Bottom dark gradient — heavier to ensure text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 from-0% via-zinc-950/40 via-[30%] to-transparent to-[100%]" />
                {/* Left vignette — stronger for text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/40 via-[45%] to-transparent" />

                {/* Content layer */}
                <div className="absolute bottom-0 left-0 p-6 md:p-16 max-w-2xl w-full">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-indigo-400 font-bold tracking-widest text-sm mb-3 uppercase flex items-center gap-2"
                    >
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Meet Dani — X Agent Director
                    </motion.p>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-white text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-[1.1]"
                    >
                        Deploy Lifelike AI Agents for{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                            Smarter Sales & Ops
                        </span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-8 max-w-xl"
                    >
                        X Agents are trained strictly on your Knowledge Bank — meaning zero hallucinations, ever. From instant lead qualification to handling tier-1 service tickets, your visitors feel like they&apos;re speaking face-to-face with a real person, hands-free. Built by a founder with deep experience in automating lead follow-ups and CRM chaos for SMBs. Connect to your tools via webhook and embed anywhere.
                        <br /><br />
                        <span className="font-semibold text-indigo-300">Clients see 50–70% ops efficiency gains →</span>
                    </motion.p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="w-full sm:w-auto"
                        >
                            {/* Inline Tavus Player Trigger */}
                            {daniAgent?.liveUrl ? (
                                <button
                                    onClick={() => setIsPlaying(true)}
                                    className="flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 font-bold px-8 py-3.5 rounded-md transition-colors w-full"
                                >
                                    <Play size={18} className="fill-black" />
                                    Start Conversation
                                </button>
                            ) : (
                                <div className="flex items-center justify-center gap-2 bg-white/50 text-black/50 font-bold px-8 py-3.5 rounded-md cursor-not-allowed w-full">
                                    <Play size={18} fill="black" className="opacity-50" />
                                    Demo Coming Soon
                                </div>
                            )}
                        </motion.div>
                        <motion.a
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            href="#beta-signup"
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-md transition-colors w-full sm:w-auto"
                        >
                            Join Beta Pilot
                            <ArrowRight size={16} />
                        </motion.a>
                    </div>
                </div>
            </motion.div>

            {/* Tavus Streaming Layer */}
            <AnimatePresence>
                {isPlaying && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 z-50 pointer-events-auto"
                    >
                        <TavusPlayer onClose={() => setIsPlaying(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
