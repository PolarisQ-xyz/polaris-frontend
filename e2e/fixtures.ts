import { test as base, expect } from '@playwright/test';

const HYDRATION_PATTERNS = [/Hydration failed/i, /did not match/i, /hydration mismatch/i];

/**
 * Every test fails if React logs a hydration mismatch — these otherwise only
 * surface as dev-console warnings and get found by luck.
 */
export const test = base.extend<{ hydrationGuard: void }>({
  hydrationGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const check = (text: string) => {
        if (HYDRATION_PATTERNS.some((re) => re.test(text))) errors.push(text);
      };
      page.on('console', (msg) => check(msg.text()));
      page.on('pageerror', (err) => check(err.message));
      await use();
      expect(errors, 'React hydration mismatch').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
