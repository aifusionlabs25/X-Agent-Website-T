import { NextResponse } from 'next/server';
import { cfg } from '@/lib/config';

export async function POST(req: Request) {
    try {
        const { personaId, turn_taking_patience, replica_interruptibility } = await req.json();

        if (!personaId) {
            return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
        }

        const patchOps = [];
        
        if (turn_taking_patience) {
            patchOps.push({
                op: 'replace',
                path: '/layers/conversational_flow/turn_taking_patience',
                value: turn_taking_patience
            });
        }
        
        if (replica_interruptibility) {
            patchOps.push({
                op: 'replace',
                path: '/layers/conversational_flow/replica_interruptibility',
                value: replica_interruptibility
            });
        }

        if (patchOps.length === 0) {
            return NextResponse.json({ error: 'No fields to update provided' }, { status: 400 });
        }

        const res = await fetch(`https://tavusapi.com/v2/personas/${personaId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': cfg.tavusApiKey || '',
            },
            body: JSON.stringify(patchOps),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to patch persona: ${res.status} ${text}`);
        }

        const data = await res.json();

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        console.error('Error patching persona:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Internal Server Error' 
        }, { status: 500 });
    }
}
