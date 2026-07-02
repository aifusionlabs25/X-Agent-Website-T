import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ALL_AGENTS } from '@/lib/agents';
import AgentDemoButton from '@/components/AgentDemoButton';

interface Props {
    params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
    return ALL_AGENTS.map((a) => ({ slug: a.slug }));
}

export default async function AgentDetailPage({ params }: Props) {
    const { slug } = await params;

    if (slug === 'hal') {
        redirect('/hal');
    }

    const agent = ALL_AGENTS.find((a) => a.slug === slug);
    if (!agent) notFound();

    return (
        <main className="min-h-screen bg-zinc-950 pt-20">
            <div className="relative h-[50vh] w-full overflow-hidden">
                <Image
                    src={agent.thumbnailSrc}
                    alt={agent.name}
                    fill
                    className="scale-105 object-cover object-top opacity-40 blur-sm"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 flex items-end gap-6 px-8 pb-8 md:px-16">
                    <div className="flex shrink-0 flex-col gap-3">
                        <div
                            className="relative h-40 w-28 overflow-hidden rounded-lg border-2 shadow-2xl md:h-52 md:w-36"
                            style={{ borderColor: agent.accentColor }}
                        >
                            <Image src={agent.thumbnailSrc} alt={agent.name} fill className="object-cover" sizes="200px" />
                        </div>

                        <AgentDemoButton agent={agent} />
                    </div>
                    <div>
                        <span
                            className="mb-1 block text-xs font-bold uppercase tracking-widest"
                            style={{ color: agent.accentColor }}
                        >
                            AI Fusion Labs X Agent
                        </span>
                        <h1 className="mb-1 text-4xl font-black tracking-widest text-white md:text-6xl">
                            {agent.name}
                        </h1>
                        <p className="text-base text-zinc-400">{agent.role}</p>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-4xl px-8 py-12">
                <div className="mb-8 border-b border-zinc-800 pb-8">
                    <h2 className="mb-3 text-xl font-semibold text-white">Overview</h2>
                    <p className="leading-relaxed text-zinc-400">
                        {agent.name} is a lifelike X Agent built by AI Fusion Labs. Trained on a
                        curated Knowledge Bank and powered by Tavus real-time video synthesis, {agent.name}{' '}
                        operates as a {agent.role.toLowerCase()} with clear handoff boundaries.
                    </p>
                </div>

                <div className="mb-10 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                    {[
                        ['Role', agent.role],
                        ['Platform', 'Tavus + OpenAI'],
                        ['Language', 'English'],
                        ['Memory', 'Knowledge Bank'],
                        ['Deployment', 'Web Embed / API'],
                        ['Emails', 'Post-session follow-up'],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                            <p className="mb-1 text-xs text-zinc-500">{label}</p>
                            <p className="font-semibold text-white">{value}</p>
                        </div>
                    ))}
                </div>

                <Link href="/#agents" className="text-sm text-zinc-500 transition-colors hover:text-white">
                    Back to all agents
                </Link>
            </div>
        </main>
    );
}
