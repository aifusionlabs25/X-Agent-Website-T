'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Info } from 'lucide-react';
import GhostlyBackground from './GhostlyBackground';

export default function HeroBillboard() {
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

                {/* Bottom dark gradient — 100% black at the very bottom edge for a smooth transition, but rapidly fading to keep her jacket bright */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 from-0% via-zinc-950/20 via-[25%] to-transparent to-[100%]" />
                {/* Left vignette */}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/75 via-zinc-950/10 to-transparent" />

                {/* Content layer */}
                <div className="absolute bottom-0 left-0 p-8 md:p-16 max-w-2xl">


                    {/* Title */}
                    <h1 className="text-white text-7xl md:text-9xl font-black tracking-widest mb-4 drop-shadow-lg">
                        DANI
                    </h1>

                    {/* Subtitle */}
                    <p className="text-zinc-300 text-base md:text-lg leading-relaxed mb-8 max-w-md">
                        X-Agent Sales Technician. Lifelike. Real-time. Always on.
                        Meet the face of AI Fusion Labs that never misses a lead.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                        {/* Play Demo → opens Vercel live demo in new tab */}
                        <a
                            href="http://localhost:3000/demo"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black font-bold px-7 py-3 rounded-md text-sm transition-colors"
                        >
                            <Play size={18} fill="black" />
                            Meet Dani
                        </a>
                        {/* More Info → agent detail sub-page */}
                        <a
                            href="/agents/dani"
                            className="flex items-center gap-2 bg-zinc-700/70 hover:bg-zinc-600/80 text-white font-semibold px-7 py-3 rounded-md text-sm transition-colors backdrop-blur-sm"
                        >
                            <Info size={18} />
                            More Info
                        </a>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
