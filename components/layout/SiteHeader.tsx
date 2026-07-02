'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SiteHeader() {
    const pathname = usePathname();

    if (pathname === '/hal') {
        return null;
    }

    return (
        <header className="fixed left-0 right-0 top-0 z-50">
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none h-32" />
            <div className="relative flex items-center justify-between px-6 md:px-8 py-4 max-w-screen-2xl mx-auto">
                <Link
                    href="/"
                    className="border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-200 backdrop-blur transition-colors hover:border-white/30 hover:text-white"
                >
                    AI Fusion Labs
                </Link>
            </div>
        </header>
    );
}
