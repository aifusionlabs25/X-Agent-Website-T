'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function SiteHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50">
            {/* Subtle Gradient fade from black to transparent for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between px-8 py-4 max-w-screen-2xl mx-auto">

                <Link href="/" className="flex items-center gap-3 group">
                    {/* Logo removed per user request */}
                </Link>

                {/* Nav */}
                <nav className="flex items-center gap-6 text-sm text-zinc-300">
                    <Link href="#agents" className="hover:text-white transition-colors">Agents</Link>
                    <Link href="#specs" className="hover:text-white transition-colors">Technology</Link>
                    <a
                        href="http://localhost:3000/demo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-5 py-2 rounded-md transition-colors"
                    >
                        Try Live Demo
                    </a>
                </nav>
            </div>
        </header>
    );
}
