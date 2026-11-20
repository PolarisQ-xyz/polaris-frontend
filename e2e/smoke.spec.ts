import { test, expect } from './fixtures/test';
import { MARKET_ID, PERP_ID } from './fixtures/data';

/** Every route renders a heading (or, for headless pages, visible body text) without a `pageerror` or console error. */
const routes = [
  '/',
  '/markets',
  '/perpetuals',
  `/market/${MARKET_ID}`,
  `/perpetual/${PERP_ID}`,
  '/bets',
  '/docs',
  '/welcome',
  '/create',
  '/admin',
  `/embed/${MARKET_ID}`,
];

for (const path of routes) {
  test(`renders ${path}`, async ({ page, errors }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const heading = page.getByRole('heading').first();
    if (await heading.count()) await expect(heading).toBeVisible();
    else await expect(page.locator('body')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}
