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
        label: 'Tavus live room',
        copy: 'Face-to-face conversation with Hal as an AI operating partner, not Brian and not a clone claim.',
        icon: Sparkles,
    },
    {
        label: 'Consent memory',
        copy: 'Returning visitors can opt in with email so Hal can recall approved notes from prior sessions.',
        icon: BrainCircuit,
    },
    {
        label: 'Hermes follow-up',
        copy: 'Post-session memory writes, AgentMail follow-ups, admin briefs, and executive artifacts now run behind the demo.',
        icon: MailCheck,
    },
    {
        label: 'Receipt-first boundary',
        copy: 'Hal can prepare and hand back. Completed-action claims require a provider receipt or human approval.',
        icon: Waypoints,
    },
];

const proofPoints = [
    ['Live', 'Tavus video + voice'],
    ['Memory', 'Email consent recall'],
    ['Hermes', 'Writes + receipts'],
    ['AgentMail', 'Follow-up emails'],
];

export default function HalPage() {
    return (
        <main className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[#080907] text-white">
            <section className="relative isolate min-h-screen max-w-[100vw] overflow-hidden">
                <Image
                    src="/agents/hal/hal-newest-2026-06-30.png"
                    alt="Hal executive-autopilot concept portrait"
                    fill
                    priority
                    className="object-cover object-[64%_center]"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,7,0.97)_0%,rgba(7,8,7,0.78)_38%,rgba(7,8,7,0.34)_72%,rgba(7,8,7,0.18)_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,7,0.18)_0%,rgba(7,8,7,0.24)_46%,rgba(7,8,7,0.88)_100%)]" />
                <div className="absolute left-0 top-0 h-full w-[58%] bg-[radial-gradient(circle_at_22%_28%,rgba(226,191,111,0.16),transparent_32%)]" />

                <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[100vw] flex-col px-5 py-5 sm:px-8 lg:max-w-7xl lg:px-10">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="inline-flex items-center border border-white/10 bg-black/30 px-4 py-2 text-xs font-black uppercase text-zinc-300 backdrop-blur transition-colors hover:border-[#d6b56d]/60 hover:text-white"
                        >
                            AI Fusion Labs
                        </Link>
                        <div className="hidden items-center gap-2 border border-[#d6b56d]/25 bg-black/30 px-3 py-2 text-xs font-black uppercase text-[#f3d68c] backdrop-blur sm:flex">
                            <span className="h-2 w-2 rounded-full bg-[#f3d68c] shadow-[0_0_16px_rgba(243,214,140,0.8)]" />
                            Hal Live
                        </div>
                    </div>

                    <div className="grid min-w-0 flex-1 items-center gap-8 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:py-5">
                        <div className="w-full min-w-0 max-w-[calc(100vw-2.5rem)] sm:max-w-2xl">
                            <p className="mb-5 max-w-xs text-sm font-black uppercase leading-6 text-[#f3d68c] sm:max-w-none sm:text-base">
                                Brian Halligan AI operating partner concept
                            </p>
                            <h1 className="text-8xl font-black leading-none text-white sm:text-9xl lg:text-[11rem]">
                                Hal
                            </h1>
                            <p className="mt-7 max-w-full text-lg leading-8 text-zinc-100 sm:text-2xl sm:leading-9">
                                A live Tavus-backed executive interface for founder conversations: approved knowledge in, consent memory across sessions, Hermes follow-up after the call, and a hard handoff line when judgment matters.
                            </p>

                            <div className="mt-9 flex flex-wrap items-center gap-5">
                                <HalDemoLauncher />
                                <p className="max-w-sm text-sm leading-6 text-zinc-300">
                                    Launches the live Hal room with opt-in memory check-in. No private Drive files, no Brian impersonation, no false action claims.
                                </p>
                            </div>

                            <div className="mt-8 grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-4">
                                {proofPoints.map(([label, value]) => (
                                    <div key={label} className="border-l border-[#d6b56d]/55 bg-black/25 px-4 py-3 backdrop-blur">
                                        <p className="text-xs font-black uppercase text-[#f3d68c]">{label}</p>
                                        <p className="mt-1 text-sm leading-5 text-zinc-200">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="min-w-0 border border-white/10 bg-[#0b0d0b]/65 p-5 shadow-2xl shadow-black/35 backdrop-blur-md sm:p-7">
                            <div className="flex items-start justify-between gap-5 border-b border-white/10 pb-5">
                                <div>
                                    <p className="text-xs font-black uppercase text-[#f3d68c]">What the demo proves</p>
                                    <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Beyond the avatar demo.</h2>
                                </div>
                                <ShieldCheck className="shrink-0 text-[#f3d68c]" size={28} />
                            </div>

                            <div className="mt-5 grid gap-4">
                            {capabilities.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.label}
                                        className="grid grid-cols-[34px_1fr] gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0"
                                    >
                                        <Icon className="mt-1 text-[#f3d68c]" size={22} />
                                        <div>
                                            <h3 className="text-lg font-black text-white">{item.label}</h3>
                                            <p className="mt-1 text-sm leading-6 text-zinc-300">{item.copy}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            </div>

                            <div className="mt-6 bg-[#d6b56d] px-5 py-4 text-black">
                                <p className="text-sm font-black uppercase">Public demo boundary</p>
                                <p className="mt-1 text-sm leading-6">
                                    Hal is built from public or approved materials only. It does not impersonate Brian Halligan or claim completed external actions without confirmation.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-zinc-500">
                        <Link href="/#agents" className="inline-flex items-center gap-2 font-bold uppercase transition-colors hover:text-white">
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
