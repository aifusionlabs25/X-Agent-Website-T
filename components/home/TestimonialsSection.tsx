import { Star, Quote } from 'lucide-react';

const testimonials = [
    {
        quote: 'Game-changer for our lead pipeline. We went from missing 40% of inbound inquiries to zero missed leads overnight.',
        author: 'Operations Manager',
        company: 'Real Estate Brokerage, AZ',
        stars: 5,
    },
    {
        quote: 'The AI agent handles our after-hours triage calls flawlessly. Our clients love the instant, human-like responses.',
        author: 'Practice Manager',
        company: 'Veterinary Clinic Group',
        stars: 5,
    },
    {
        quote: 'We replaced three SaaS tools with a single X Agent. The Knowledge Bank means it never says anything off-script.',
        author: 'VP of Sales',
        company: 'B2B SaaS Company',
        stars: 5,
    },
];

export default function TestimonialsSection() {
    return (
        <section id="testimonials" className="bg-zinc-950 py-24 px-8">
            <div className="max-w-screen-xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-3">Early Feedback</p>
                    <h2 className="text-white text-3xl md:text-4xl font-bold mb-4">
                        What Early Users Say
                    </h2>
                    <p className="text-zinc-400 text-base max-w-lg mx-auto">
                        Real reactions from our first beta pilot clients.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {testimonials.map((t, i) => (
                        <div
                            key={i}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col hover:border-indigo-500/30 transition-colors"
                        >
                            <Quote size={24} className="text-indigo-500/30 mb-4" />
                            <p className="text-zinc-300 text-sm leading-relaxed mb-6 flex-grow italic">
                                &ldquo;{t.quote}&rdquo;
                            </p>
                            <div className="flex items-center gap-1 mb-3">
                                {Array.from({ length: t.stars }).map((_, si) => (
                                    <Star key={si} size={14} className="text-amber-400 fill-amber-400" />
                                ))}
                            </div>
                            <p className="text-white text-sm font-semibold">{t.author}</p>
                            <p className="text-zinc-500 text-xs">{t.company}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
