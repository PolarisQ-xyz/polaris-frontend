export function OddsBar({ yesBps }: { yesBps: number; noBps: number }) {
  // yesBps + noBps === 10000, so NO is derived from rounded YES to keep the labels summing to 100
  const yesPct = Math.round(yesBps / 100);
  const noPct = 100 - yesPct;

  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span style={{ color: 'var(--yes)' }}>YES {yesPct}%</span>
        <span style={{ color: 'var(--no)' }}>NO {noPct}%</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div style={{ width: `${yesPct}%`, background: 'var(--yes)' }} />
        <div style={{ width: `${noPct}%`, background: 'var(--no)' }} />
      </div>
    </div>
  );
}
