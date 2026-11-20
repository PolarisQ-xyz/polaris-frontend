// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultReveal } from './result-reveal';
import { cleanup, render, text } from '@/test/render';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const XLM = 10_000_000n;

afterEach(cleanup);

describe('ResultReveal', () => {
  it('ResolvedYes holding YES: won, exact payout', async () => {
    await render(<ResultReveal status="ResolvedYes" position={{ yes: 25n * XLM, no: 3n * XLM }} />);
    expect(document.querySelector('.result-reveal__headline')?.textContent).toBe('You won');
    expect(document.querySelector('.result-reveal__detail')?.textContent).toBe('+25.00 XLM');
    expect(document.querySelector('.result-reveal--won')).not.toBeNull();
  });

  it('ResolvedYes holding only NO: lost, no amount shown', async () => {
    await render(<ResultReveal status="ResolvedYes" position={{ yes: 0n, no: 12n * XLM }} />);
    expect(document.querySelector('.result-reveal__headline')?.textContent).toBe("Didn't win this one");
    expect(document.querySelector('.result-reveal__detail')).toBeNull();
    expect(text()).not.toContain('XLM');
    expect(document.querySelector('.result-reveal--lost')).not.toBeNull();
  });

  it('Cancelled: refund is (yes + no) / 2, not the sum', async () => {
    await render(<ResultReveal status="Cancelled" position={{ yes: 10n * XLM, no: 4n * XLM }} />);
    expect(document.querySelector('.result-reveal__headline')?.textContent).toBe('Market cancelled');
    expect(document.querySelector('.result-reveal__detail')?.textContent).toBe('Refunded 7.00 XLM');
    expect(document.querySelector('.result-reveal--neutral')).not.toBeNull();
  });

  it('Open: renders nothing', async () => {
    const container = await render(<ResultReveal status="Open" position={{ yes: 5n * XLM, no: 0n }} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the next-round link when given', async () => {
    await render(
      <ResultReveal status="ResolvedNo" position={{ yes: 0n, no: XLM }} nextRoundHref="/market/CNEXT" />,
    );
    const link = document.querySelector<HTMLAnchorElement>('a.result-reveal__next');
    expect(link?.getAttribute('href')).toBe('/market/CNEXT');
    expect(link?.textContent).toBe('Next round is live →');
  });
});
