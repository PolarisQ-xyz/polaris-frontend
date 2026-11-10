import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/landing-header';
import { Hero } from '@/components/landing/hero';
import { TrustStrip } from '@/components/landing/trust-strip';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Features } from '@/components/landing/features';
import { TryItLive } from '@/components/landing/try-it-live';
import { ForBuilders } from '@/components/landing/for-builders';
import { Faq } from '@/components/landing/faq';
import { FinalCta } from '@/components/landing/final-cta';
import { LandingFooter } from '@/components/landing/landing-footer';

export const metadata: Metadata = {
  title: 'Polaris — Predict XLM. Trade it with your own wallet.',
  description:
    'A fully-collateralized prediction market on XLM/USD, settled automatically by a live price feed. Connect Freighter and sign every trade yourself — no custodial account.',
};

export default function WelcomePage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <Features />
        <TryItLive />
        <ForBuilders />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
