'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const quickLinks = [
    ['Agents', '/#agents'],
    ['Technology', '/#specs'],
    ['How It Works', '/#how-it-works'],
    ['Pricing', '/#pricing'],
    ['FAQ', '/#faq'],
];

export default function SiteFooter() {
    const pathname = usePathname();

    if (pathname === '/hal') {
        return null;
    }

    return (
        <footer className="border-t border-zinc-800 bg-zinc-950 px-8 py-10">
            <div className="mx-auto grid max-w-screen-xl gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
                <div>
                    <p className="text-lg font-black text-white">AI Fusion Labs</p>
                    <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
                        We build Tavus-backed X Agents that turn approved knowledge into face-to-face conversations, memory-backed follow-up, and operator-safe automation.
                    </p>
                </div>

                <div>
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Explore</p>
                    <nav className="grid gap-2 text-sm">
                        {quickLinks.map(([label, href]) => (
                            <Link key={label} href={href} className="text-zinc-500 transition-colors hover:text-white">
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div>
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Connect</p>
                    <nav className="grid gap-2 text-sm">
                        <a href="mailto:aifusionlabs@gmail.com" className="text-zinc-500 transition-colors hover:text-white">
                            aifusionlabs@gmail.com
                        </a>
                        <a
                            href="https://x.com/AI_FusionLabs"
                            className="text-zinc-500 transition-colors hover:text-white"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            X / AI Fusion Labs
                        </a>
                    </nav>
                </div>
            </div>
            <div className="mx-auto mt-8 max-w-screen-xl border-t border-zinc-900 pt-5 text-xs text-zinc-600">
                (c) {new Date().getFullYear()} AI Fusion Labs. All rights reserved.
            </div>
        </footer>
    );
}
