import { Reveal } from './reveal';

const STEPS = [
  {
    title: 'Connect Freighter',
    body: 'One click, you sign every trade yourself. No Freighter? Sign in with email instead.',
  },
  {
    title: 'Pick YES or NO',
    body: 'Trade live, AMM-priced odds — buy in, watch the price move, exit early if you want.',
  },
  {
    title: 'Get paid instantly',
    body: 'Winning positions redeem 1:1 the moment the market settles. No claim step, no waiting.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-[var(--ink-soft)]">
            From landing here to holding a position takes about thirty seconds.
          </p>
        </div>
      </Reveal>

      <ol className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delayMs={i * 100}>
            <li className="relative text-center sm:text-left">
              <span
                aria-hidden
                className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #5b4fe0, #8b7bff)' }}
              >
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-[var(--ink-soft)]">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
