import { test as base, expect } from '@playwright/test';
import { mockOracle } from './mock-oracle';

/**
 * Base test: oracle mocked, any other cross-origin request (Soroban RPC,
 * fonts, analytics) answered with an empty 200 so no test touches the
 * network, and every `pageerror`/console error collected in `errors`.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.route(/^https?:\/\/(?!localhost|oracle\.mock)/, (route) => route.fulfill({ status: 200, body: '' }));
    await mockOracle(page);
    await provide(errors);
  },
});

export { expect };
