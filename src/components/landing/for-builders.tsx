import { Reveal } from './reveal';

const SNIPPET = `<iframe
  src="https://polaris.app/embed/<market-id>"
  width="360"
  height="420"
></iframe>`;

export function ForBuilders() {
  return (
    <section className="border-y border-[var(--line)] bg-[var(--surface-2)]/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
            For builders
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Embed a market on your own site
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-[var(--ink-soft)]">
            Just an iframe, no special permissions. The same wallet a visitor connects on
            your site works everywhere else Polaris is embedded — it&rsquo;s a portable identity,
            not a separate login per surface.
          </p>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--no)]/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--warn)]/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--yes)]/60" />
            </div>
            <pre className="p-4 text-sm leading-relaxed">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
