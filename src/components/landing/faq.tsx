import { Reveal } from './reveal';

const QUESTIONS = [
  {
    q: 'Is this gambling?',
    a: 'Polaris is a prediction market — you take a position on a real-world price outcome, priced by supply and demand, not a house edge. That said, you can lose your full stake on the losing side, same as any market. Trade with money you can afford to lose.',
  },
  {
    q: "What happens if the price oracle goes down?",
    a: "Settlement never depends on any single party staying online. If a market can't be settled by its expiry, anyone can permissionlessly trigger a full refund after a grace period — funds are never stuck waiting on us.",
  },
  {
    q: 'Do I need to already own crypto?',
    a: "You'll need the Freighter wallet extension and a small amount of XLM to trade — same as any other Stellar app. Don't have a wallet yet? Sign in with email instead and skip both.",
  },
  {
    q: 'Is my money safe?',
    a: 'Every position is fully collateralized — funds only ever move automatically, based on the market’s own rules, never through an admin key. The contracts are open source; see the docs for the full trust model and known limitations.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <Reveal>
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
      </Reveal>

      <div className="mt-12 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:content-none">
              {item.q}
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-5 w-5 flex-none text-[var(--faint)] transition-transform duration-200 group-open:rotate-180"
              >
                <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
              </svg>
            </summary>
            <p className="mt-3 max-w-2xl leading-relaxed text-[var(--ink-soft)]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
