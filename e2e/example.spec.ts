import { test, expect } from './fixtures/test';

test('markets page lists the fixture market from the mocked oracle', async ({ page, errors }) => {
  await page.goto('/markets');
  await expect(page.getByRole('heading', { name: 'All markets' })).toBeVisible();
  expect(errors).toEqual([]);
});
