import { test, expect } from './fixtures';

for (const path of ['/', '/welcome', '/markets', '/docs']) {
  test(`${path} renders without hydration mismatch`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
}
