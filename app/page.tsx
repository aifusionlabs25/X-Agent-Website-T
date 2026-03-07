import HeroBillboard from '@/components/home/HeroBillboard';
import AgentCarouselRow from '@/components/home/AgentCarouselRow';
import TechSpecsSection from '@/components/home/TechSpecsSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import PricingSection from '@/components/home/PricingSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import FAQSection from '@/components/home/FAQSection';
import BetaSignupSection from '@/components/home/BetaSignupSection';
import { ALL_AGENTS, SALES_AGENTS, SERVICE_AGENTS } from '@/lib/agents';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Hero Billboard */}
      <HeroBillboard />

      {/* Technology / Specs */}
      <TechSpecsSection />

      {/* Agent Carousels */}
      <div id="agents" className="pt-8">
        <AgentCarouselRow title="Top Picks — Sales & SDR" agents={SALES_AGENTS} />
        <AgentCarouselRow title="Operations & Service Agents" agents={SERVICE_AGENTS} />
        <AgentCarouselRow title="Full Agent Roster" agents={ALL_AGENTS} />
      </div>

      {/* How It Works */}
      <HowItWorksSection />

      {/* Pricing */}
      <PricingSection />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* FAQ */}
      <FAQSection />

      {/* Beta Sign-Up */}
      <BetaSignupSection />
    </main>
  );
}
