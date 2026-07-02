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
                className="inline-flex w-full min-w-0 items-center justify-center gap-3 bg-[#d6b56d] px-10 py-5 text-sm font-black uppercase text-black shadow-[0_18px_60px_rgba(214,181,109,0.22)] transition-colors hover:bg-[#f0cf86] focus:outline-none focus:ring-2 focus:ring-[#f0cf86] focus:ring-offset-2 focus:ring-offset-black sm:w-auto sm:min-w-[276px]"
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
