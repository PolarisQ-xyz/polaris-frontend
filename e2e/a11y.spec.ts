import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures/test';
import { MARKET_ID } from './fixtures/data';

/**
 * Known, already-tracked violations — `rule id → issue`. Remove an entry
 * once its issue is fixed so the check starts guarding it.
 */
const KNOWN_ISSUES: Record<string, string> = {
  // 'color-contrast': '#20',
};

const pages = ['/', `/market/${MARKET_ID}`, '/bets', `/embed/${MARKET_ID}`, '/admin'];

for (const path of pages) {
  test(`no serious/critical axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).disableRules(Object.keys(KNOWN_ISSUES)).analyze();
    const blocking = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.helpUrl}`);
    expect(blocking).toEqual([]);
  });
}
