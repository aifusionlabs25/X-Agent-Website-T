import { cfg } from '@/lib/config';
import TavusTuningPanel from '@/components/admin/TavusTuningPanel';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AdminTavusPage() {
    // Note: cfg.personaId is available on the server
    const personaId = cfg.personaId;

    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative">
            <div className="absolute top-8 left-8">
                <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                    Back to Showcase
                </Link>
            </div>

            <div className="mb-12 text-center max-w-2xl mt-16 sm:mt-0">
                <h1 className="text-4xl font-black text-white mb-4">Internal Tooling</h1>
                <p className="text-zinc-400 text-lg">
                    Configure the conversational engine for your agents. Changes made here patch the Persona on Tavus and apply immediately to the next launched session.
                </p>
            </div>

            <TavusTuningPanel personaId={personaId} agentName="Dani" />
        </main>
    );
}
