import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BrainCircuit, ShieldCheck, Waypoints } from 'lucide-react';
import HalDemoLauncher from '@/components/hal/HalDemoLauncher';

export const metadata = {
    title: 'Hal | AI Fusion Labs',
    description: 'A Tavus-backed executive operating partner prototype inspired by Brian Halligan public-source concepts.',
};

const principles = [
    {
        label: 'Public-source safe',
        copy: 'Uses public or explicitly approved material only. No private Drive files are assumed or scraped.',
        icon: ShieldCheck,
    },
    {
        label: 'Memory with consent',
        copy: 'Email check-in can recall approved Hal-session notes without exposing raw email, hashes, or backend details.',
        icon: BrainCircuit,
    },
    {
        label: 'Autopilot boundary',
        copy: 'Hal can reason, prepare, and hand back. It does not impersonate Brian or claim completed actions without confirmation.',
        icon: Waypoints,
    },
];

export default function HalPage() {
    return (
        <main className="min-h-screen bg-[#080906] text-white">
            <section className="relative min-h-[92vh] overflow-hidden border-b border-white/10">
                <Image
                    src="/agents/hal/hal-newest-2026-06-30.png"
                    alt="Hal concept portrait"
                    fill
                    priority
                    className="object-cover object-[72%_center]"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,6,0.98)_0%,rgba(8,9,6,0.86)_38%,rgba(8,9,6,0.44)_64%,rgba(8,9,6,0.12)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#080906] to-transparent" />

                <div className="relative z-10 flex min-h-[92vh] flex-col justify-between px-5 py-6 sm:px-8 lg:px-12">
                    <nav className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:text-white"
                        >
                            <ArrowLeft size={15} />
                            X Agents
                        </Link>
                        <span className="border border-[#d6b56d]/35 bg-black/35 px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#f3d68c] backdrop-blur">
                            Tavus Prototype
                        </span>
                    </nav>

                    <div className="max-w-[740px] pb-12 pt-16 sm:pt-24 lg:pb-20">
                        <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-[#f3d68c]">
                            Brian Halligan AI operating partner concept
                        </p>
                        <h1 className="max-w-[10ch] text-[clamp(4rem,14vw,10rem)] font-black leading-[0.82] tracking-normal text-white">
                            Hal
                        </h1>
                        <p className="mt-7 max-w-[620px] text-lg leading-8 text-zinc-200 sm:text-xl">
                            A consent-safe executive-autopilot interface: not Brian, not a clone claim, and not a gimmick. Hal is a Tavus-backed face-to-face prototype for reasoning from approved knowledge, remembering prior sessions, and knowing when to hand back.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <HalDemoLauncher />
                            <p className="max-w-[360px] text-xs leading-5 text-zinc-400">
                                Launches a live Tavus room. Zoom and Teams meeting presence remains a separate transport spike, not part of this public demo claim.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-[#0f110c] px-5 py-10 sm:px-8 lg:px-12">
                <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
                    {principles.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="border-l border-[#d6b56d]/40 pl-5">
                                <Icon className="mb-4 text-[#f3d68c]" size={24} />
                                <h2 className="text-lg font-black text-white">{item.label}</h2>
                                <p className="mt-3 text-sm leading-6 text-zinc-400">{item.copy}</p>
                            </div>
                        );
                    })}
                </div>
            </section>
        </main>
    );
}
