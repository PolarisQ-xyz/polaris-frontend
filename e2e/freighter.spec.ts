import { test, expect } from './fixtures/test';
import { installFreighter, freighterRequest, setFreighter, PUBNET } from './fixtures/freighter-stub';
import { TEST_ADDRESS } from './fixtures/data';

const short = `${TEST_ADDRESS.slice(0, 6)}…${TEST_ADDRESS.slice(-4)}`;
const connectButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Connect( Wallet)?$/ }).first();

test('connect success shows the wallet address', async ({ page }) => {
  await installFreighter(page);
  await page.goto('/markets');
  await connectButton(page).click();
  await expect(page.getByText(short).first()).toBeVisible();
});

test('already-authorized wallet is restored silently on load', async ({ page }) => {
  await installFreighter(page, { connected: true });
  await page.goto('/markets');
  await expect(page.getByText(short).first()).toBeVisible();
});

test('connect reject surfaces the rejection', async ({ page }) => {
  await installFreighter(page, { connect: 'reject' });
  await page.goto('/markets');
  await connectButton(page).click();
  await expect(page.getByText('The user rejected this request.').first()).toBeVisible();
});

test('wrong network is refused', async ({ page }) => {
  await installFreighter(page, { networkPassphrase: PUBNET });
  await page.goto('/markets');
  await connectButton(page).click();
  await expect(page.getByText(/wrong network/i).first()).toBeVisible();
});

test('connect hang leaves the prompt pending', async ({ page }) => {
  await installFreighter(page, { connect: 'hang' });
  await page.goto('/markets');
  await connectButton(page).click();
  await expect(page.getByRole('button', { name: 'Confirm in Freighter…' })).toBeVisible();
});

test.describe('signing', () => {
  test('sign success echoes a signed transaction', async ({ page }) => {
    await installFreighter(page, { connected: true });
    await page.goto('/docs');
    const res = (await freighterRequest(page, { type: 'SUBMIT_TRANSACTION', transactionXdr: 'AAAA' })) as Record<string, unknown>;
    expect(res.signedTransaction).toBe('AAAA');
    expect(res.signerAddress).toBe(TEST_ADDRESS);
  });

  test('sign reject returns a user-rejected error', async ({ page }) => {
    await installFreighter(page, { connected: true, sign: 'reject' });
    await page.goto('/docs');
    const res = (await freighterRequest(page, { type: 'SUBMIT_TRANSACTION', transactionXdr: 'AAAA' })) as Record<string, { code: number }>;
    expect(res.apiError.code).toBe(-4);
  });

  test('sign hang never answers (drives the app-side timeout)', async ({ page }) => {
    await installFreighter(page, { connected: true, sign: 'hang' });
    await page.goto('/docs');
    expect(await freighterRequest(page, { type: 'SUBMIT_TRANSACTION', transactionXdr: 'AAAA' }, 500)).toBe('timeout');
  });

  test('account switch is visible to the next request', async ({ page }) => {
    await installFreighter(page, { connected: true });
    await page.goto('/docs');
    await setFreighter(page, { address: 'GOTHERACCOUNT' });
    const res = (await freighterRequest(page, { type: 'REQUEST_PUBLIC_KEY' })) as Record<string, string>;
    expect(res.publicKey).toBe('GOTHERACCOUNT');
  });
});
