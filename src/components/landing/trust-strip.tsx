const ITEMS = [
  'Fully collateralized',
  'Settled by a live price feed',
  'No house edge',
  'You hold the keys',
];

export function TrustStrip() {
  return (
    <section aria-label="Trust signals" className="border-y border-[var(--line)] bg-[var(--surface-2)]/50">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-5 text-sm font-medium text-[var(--ink-soft)] sm:justify-between sm:px-8">
        {ITEMS.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 flex-none text-[var(--accent-ink)]">
              <path
                fill="currentColor"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0Z"
              />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
