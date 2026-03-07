// lib/agents.ts — Single source of truth for all X Agent display data.
// Thumbnail paths match Nova's exact spec in /public/agents/thumbnails/

import { AgentData } from '@/components/home/AgentThumbnail';

export const ALL_AGENTS: AgentData[] = [
    {
        slug: 'dani',
        name: 'DANI',
        role: 'X-Agent Sales Technician',
        thumbnailSrc: '/agents/hero/dani-hero-wide.jpg', // crop of hero until dani thumbnail added
        accentColor: '#6366f1',
        liveUrl: 'https://dani-x-agent.vercel.app/',
    },
    {
        slug: 'james',
        name: 'JAMES',
        role: 'X-Agent Legal Intake',
        thumbnailSrc: '/agents/thumbnails/james-intake.jpg',
        accentColor: '#3b82f6',
        liveUrl: 'https://james.aifusionlabs.app/',
    },
    {
        slug: 'morgan',
        name: 'MORGAN',
        role: 'X-Agent Field Service',
        thumbnailSrc: '/agents/thumbnails/morgan-field-service.jpg',
        accentColor: '#10b981',
        liveUrl: 'https://x-agent-app.vercel.app/',
    },
    {
        slug: 'amy',
        name: 'AMY',
        role: 'X-Agent SDR',
        thumbnailSrc: '/agents/thumbnails/amy-sdr.jpg',
        accentColor: '#ec4899',
        liveUrl: 'https://amy-insight-sdr.vercel.app/',
    },
    {
        slug: 'luna',
        name: 'LUNA',
        role: 'X-Agent Vet Triage',
        thumbnailSrc: '/agents/thumbnails/luna-vet-triage.jpg',
        accentColor: '#8b5cf6',
    },
    {
        slug: 'sarah-netic',
        name: 'SARAH-NETIC',
        role: 'X-Agent SDR',
        thumbnailSrc: '/agents/thumbnails/sarah-netic-sdr.jpg',
        accentColor: '#f59e0b',
        liveUrl: 'https://netic-sarah-app.vercel.app/',
    },
];

// Sales row: Dani first, then Amy, Sarah-Netic — all unique images
export const SALES_AGENTS: AgentData[] = [
    ALL_AGENTS.find(a => a.slug === 'dani')!,
    ALL_AGENTS.find(a => a.slug === 'amy')!,
    ALL_AGENTS.find(a => a.slug === 'sarah-netic')!,
];

// Service row: James, Morgan, Luna — all unique images
export const SERVICE_AGENTS: AgentData[] = [
    ALL_AGENTS.find(a => a.slug === 'james')!,
    ALL_AGENTS.find(a => a.slug === 'morgan')!,
    ALL_AGENTS.find(a => a.slug === 'luna')!,
];
