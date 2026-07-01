'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play } from 'lucide-react';
import HalTavusPlayer from '@/components/hal/HalTavusPlayer';

export default function HalDemoLauncher() {
    const [open, setOpen] = useState(false);
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setPortalRoot(document.body);
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center gap-3 bg-[#d6b56d] px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-black transition-colors hover:bg-[#f0cf86] focus:outline-none focus:ring-2 focus:ring-[#f0cf86] focus:ring-offset-2 focus:ring-offset-black"
            >
                <Play size={18} className="fill-black" />
                Launch Hal
            </button>
            {open && portalRoot
                ? createPortal(<HalTavusPlayer onClose={() => setOpen(false)} />, portalRoot)
                : null}
        </>
    );
}
