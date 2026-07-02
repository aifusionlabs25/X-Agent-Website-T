import Image from 'next/image';
import Link from 'next/link';
import { BrainCircuit, CheckCircle2, MailCheck, ShieldCheck, Sparkles, Waypoints } from 'lucide-react';
import HalDemoLauncher from '@/components/hal/HalDemoLauncher';

export const metadata = {
    title: 'Hal | AI Fusion Labs',
    description: 'A Tavus-backed executive operating partner prototype inspired by public-source Hal concepts.',
};

const capabilities = [
    {
        label: 'Live Tavus presence',
        copy: 'A face-to-face Hal room with real-time video, voice, and a clear boundary: Hal is not Brian and never claims to be.',
        icon: Sparkles,
    },
    {
        label: 'Consent memory',
        copy: 'Email check-in can recall approved notes from prior Hal sessions while keeping raw email, hashes, and backend details hidden.',
        icon: BrainCircuit,
    },
    {
        label: 'Executive follow-up',
        copy: 'Hermes can turn a session into a warm recap, an admin brief, and a structured executive artifact when the conversation calls for it.',
        icon: MailCheck,
    },
    {
        label: 'Autopilot boundary',
        copy: 'Hal can reason, prepare, and hand back. External actions still need a receipt or human approval before Hal says they happened.',
        icon: Waypoints,
    },
];

const proofPoints = [
    ['Source model', 'Public or explicitly approved knowledge only'],
    ['Returning user', 'Email-based consent memory'],
    ['Post-session', 'Memory write plus AgentMail follow-up'],
    ['Operator safety', 'Receipt-first action claims'],
];

export default function HalPage() {
    return (
        <main className="min-h-screen bg-[#060706] text-white lg:h-screen lg:overflow-hidden">
            <section className="relative isolate min-h-screen overflow-hidden">
                <Image
                    src="/agents/hal/hal-newest-2026-06-30.png"
                    alt="Hal executive-autopilot concept portrait"
                    fill
                    priority
                    className="object-cover object-[70%_center]"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,6,0.99)_0%,rgba(6,7,6,0.9)_34%,rgba(6,7,6,0.58)_63%,rgba(6,7,6,0.18)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(214,181,109,0.18),transparent_30%),linear-gradient(180deg,rgba(6,7,6,0.22)_0%,rgba(6,7,6,0.92)_100%)]" />

                <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="inline-flex items-center border border-white/10 bg-black/35 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-300 backdrop-blur transition-colors hover:border-[#d6b56d]/60 hover:text-white"
                        >
                            AI Fusion Labs
                        </Link>
                        <div className="hidden items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#f3d68c] sm:flex">
                            <span className="h-2 w-2 rounded-full bg-[#f3d68c]" />
                            Hal Live
                        </div>
                    </div>

                    <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:py-4">
                        <div className="max-w-2xl">
                            <p className="mb-4 text-[0.9rem] font-black uppercase tracking-[0.22em] text-[#f3d68c]">
                                Brian Halligan AI operating partner concept
                            </p>
                            <h1 className="text-[clamp(5.5rem,17vw,12rem)] font-black leading-[0.78] tracking-normal text-white">
                                Hal
                            </h1>
                            <p className="mt-7 max-w-[650px] text-lg leading-8 text-zinc-100 sm:text-xl">
                                Hal is a Tavus-backed operating-partner prototype for founder conversations: it reads from approved context, remembers what a returning visitor allowed it to remember, turns sessions into executive follow-up, and hands back anything that needs human judgment.
                            </p>

                            <div className="mt-8 flex flex-wrap items-center gap-4">
                                <HalDemoLauncher />
                                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-4">
                                    {proofPoints.map(([label, value]) => (
                                        <div key={label} className="border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
                                            <p className="font-black uppercase tracking-[0.16em] text-[#f3d68c]">{label}</p>
                                            <p className="mt-1 leading-5">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {capabilities.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <article
                                        key={item.label}
                                        className="border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur-md"
                                    >
                                        <Icon className="text-[#f3d68c]" size={23} />
                                        <h2 className="mt-5 text-lg font-black text-white">{item.label}</h2>
                                        <p className="mt-3 text-sm leading-6 text-zinc-300">{item.copy}</p>
                                    </article>
                                );
                            })}

                            <div className="sm:col-span-2 border border-[#d6b56d]/30 bg-[#d6b56d]/10 p-5 backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 shrink-0 text-[#f3d68c]" size={24} />
                                    <div>
                                        <h2 className="text-lg font-black text-white">Public-demo claim</h2>
                                        <p className="mt-2 text-sm leading-6 text-zinc-200">
                                            This page demonstrates Hal as a consent-safe AI operating partner interface. It does not impersonate Brian Halligan, use private Drive files, or imply completed external actions without confirmation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-zinc-500">
                        <Link href="/#agents" className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.18em] transition-colors hover:text-white">
                            <CheckCircle2 size={15} />
                            Back to roster
                        </Link>
                        <p className="hidden sm:block">Built as an AI Fusion Labs Tavus X Agent prototype.</p>
                    </div>
                </div>
            </section>
        </main>
    );
}
