import { test, expect } from './fixtures/test';
import { mockOracle } from './fixtures/mock-oracle';
import { market } from './fixtures/data';

test('markets page lists the fixture market from the mocked oracle', async ({ page, errors }) => {
  await page.goto('/markets');
  await expect(page.getByRole('heading', { name: 'All markets' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('homepage featured-card cycles through markets when "Next market" is clicked', async ({ page, errors }) => {
  const market2 = { ...market, contractId: 'CMARKETFIXTURE2000000000000000000000000000000000000000000', strikePriceCents: '50' };
  await mockOracle(page, { '/markets': [market, market2] });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // first featured card shows market 1 strike
  await expect(page.getByText(/≥ \$0\.25/)).toBeVisible();
  // "Next market" button is present
  const nextBtn = page.getByRole('button', { name: /next market/i });
  await expect(nextBtn).toBeVisible();

  await nextBtn.click();
  // second card shows market 2 strike
  await expect(page.getByText(/≥ \$0\.50/)).toBeVisible();
  expect(errors).toEqual([]);
});
