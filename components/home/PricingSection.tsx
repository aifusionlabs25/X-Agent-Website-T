import { Check } from 'lucide-react';

const tiers = [
    {
        name: 'Starter',
        pilot: '$500',
        monthly: '$250',
        minutes: '100',
        description: 'Ideal for teams exploring AI-assisted workflows and basic automations.',
        features: [
            'Single X Agent persona',
            'Email-based lead follow-up',
            'Session transcripts & summaries',
            'Email notifications & alerts',
            '100 action minutes/mo',
        ],
        cta: 'Get Started',
        popular: false,
        isEnterprise: false,
    },
    {
        name: 'Pro',
        pilot: '$1,000',
        monthly: '$500',
        minutes: '500',
        description: 'For teams ready to integrate AI agents into their existing sales and CRM stack.',
        features: [
            'Single X Agent persona',
            'CRM integration (Salesforce)',
            'Custom data pipelines',
            'Lead scoring & intelligence emails',
            'Transcript archival & analytics',
            '500 action minutes/mo',
        ],
        cta: 'Get Started',
        popular: true,
        isEnterprise: false,
    },
    {
        name: 'Enterprise',
        pilot: '',
        monthly: '',
        minutes: '',
        description: 'Full-scale deployment with dedicated engineering, custom integrations, and priority support.',
        features: [
            'Multiple X Agent personas',
            'Full API & webhook access',
            'White-label deployment',
            'Custom Knowledge Bank curation',
            'Dedicated onboarding & support',
            'Priority engineering queue',
            'Custom minute allocation',
        ],
        cta: 'Contact Us',
        popular: false,
        isEnterprise: true,
    },
];

export default function PricingSection() {
    return (
        <section id="pricing" className="bg-zinc-950 py-24 px-8">
            <div className="max-w-screen-xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-3">Pricing</p>
                    <h2 className="text-white text-3xl md:text-4xl font-bold mb-4">
                        Straightforward Pricing
                    </h2>
                    <p className="text-zinc-400 text-base max-w-2xl mx-auto">
                        Start with a one-time pilot build, then scale with a monthly subscription. Reach out if you need something custom.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`relative bg-zinc-900 rounded-xl p-8 flex flex-col border transition-colors ${tier.popular
                                ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
                                : 'border-zinc-800 hover:border-zinc-700'
                                }`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wide">
                                    MOST POPULAR
                                </div>
                            )}
                            <h3 className="text-white text-xl font-bold mb-1">{tier.name}</h3>
                            <p className="text-zinc-500 text-sm mb-6">{tier.description}</p>

                            <div className="mb-6">
                                {tier.isEnterprise ? (
                                    <>
                                        <span className="text-white text-3xl font-black">Let&apos;s Talk</span>
                                        <p className="text-zinc-500 text-sm mt-1">Custom pricing based on scope</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-baseline gap-1 mb-1">
                                            <span className="text-white text-4xl font-black">{tier.monthly}</span>
                                            <span className="text-zinc-500 text-sm">/mo</span>
                                        </div>
                                        <p className="text-zinc-500 text-sm">+ {tier.pilot} one-time pilot build</p>
                                    </>
                                )}
                            </div>

                            <ul className="space-y-3 mb-8 flex-grow">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                        <Check size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href="#beta-signup"
                                className={`block text-center font-bold py-3 rounded-lg text-sm transition-colors ${tier.popular
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                    }`}
                            >
                                {tier.cta}
                            </a>
                        </div>
                    ))}
                </div>

                <p className="text-center text-zinc-600 text-sm mt-8">
                    Need something outside of these tiers?{' '}
                    <a href="#beta-signup" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Let&apos;s chat</a>.
                </p>
            </div>
        </section>
    );
}
