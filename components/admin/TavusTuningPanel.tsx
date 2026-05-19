'use client';

import { useState } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
    personaId: string;
    agentName?: string;
}

export default function TavusTuningPanel({ personaId, agentName = 'Dani' }: Props) {
    const [patience, setPatience] = useState('medium');
    const [interruptibility, setInterruptibility] = useState('medium');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleApply = async () => {
        setStatus('loading');
        setErrorMessage('');
        
        try {
            const res = await fetch('/api/persona/patch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personaId,
                    turn_taking_patience: patience,
                    replica_interruptibility: interruptibility,
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Failed to apply patch');
            }
            
            setStatus('success');
            setTimeout(() => setStatus('idle'), 4000); // reset after 4s
        } catch (e: unknown) {
            setStatus('error');
            setErrorMessage(e instanceof Error ? e.message : 'An unknown error occurred');
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl max-w-xl w-full mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Settings className="text-indigo-400" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Sparrow-1 Tuning</h2>
                    <p className="text-sm text-zinc-400">Configure conversational floor mechanics for the active local agent.</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
                        <span className="font-bold text-white uppercase">{agentName}</span>
                        <span className="text-indigo-500/50">|</span>
                        <span>{personaId}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Turn Taking Patience */}
                <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        Turn Taking Patience
                    </label>
                    <p className="text-xs text-zinc-500 mb-3">
                        Controls how eagerly your persona responds. Low for fast-paced exchanges, High for thoughtful conversations.
                    </p>
                    <select
                        value={patience}
                        onChange={(e) => setPatience(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none"
                    >
                        <option value="low">Low (Eager / Fast Paced)</option>
                        <option value="medium">Medium (Balanced)</option>
                        <option value="high">High (Patient / Thoughtful)</option>
                    </select>
                </div>

                {/* Replica Interruptibility */}
                <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        Replica Interruptibility
                    </label>
                    <p className="text-xs text-zinc-500 mb-3">
                        Controls how easily your persona can be interrupted while speaking. High for user-driven interactions.
                    </p>
                    <select
                        value={interruptibility}
                        onChange={(e) => setInterruptibility(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none"
                    >
                        <option value="low">Low (Hard to interrupt)</option>
                        <option value="medium">Medium (Standard)</option>
                        <option value="high">High (Easily interrupted)</option>
                    </select>
                </div>
            </div>

            {/* Status Messages */}
            {status === 'error' && (
                <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                </div>
            )}
            
            {status === 'success' && (
                <div className="mt-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 size={16} />
                    <span>Sparrow-1 settings successfully patched to Tavus!</span>
                </div>
            )}

            {/* Action */}
            <div className="mt-8">
                <button
                    onClick={handleApply}
                    disabled={status === 'loading'}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                    {status === 'loading' ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    {status === 'loading' ? 'Patching Persona...' : 'Apply Sparrow-1 Patch'}
                </button>
            </div>
        </div>
    );
}
