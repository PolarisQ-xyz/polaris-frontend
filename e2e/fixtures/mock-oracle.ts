import type { Page, Route } from '@playwright/test';
import { MOCK_ORACLE_URL } from '../../playwright.config';
import * as d from './data';

type Handler = (url: URL, route: Route) => unknown;

/** Path → fixture body. First match wins; anything unlisted gets a 404 so a missing fixture is loud, not silent. */
const routes: [RegExp, Handler][] = [
  [/^\/markets$/, () => [d.market]],
  [/^\/markets\/[^/]+$/, () => d.market],
  [/^\/markets\/[^/]+\/state$/, () => d.marketState],
  [/^\/markets\/[^/]+\/price$/, () => d.price],
  [/^\/markets\/[^/]+\/fee$/, () => d.fee],
  [/^\/markets\/[^/]+\/position$/, () => d.position],
  [/^\/perpetuals$/, () => [d.perpetual]],
  [/^\/perpetuals\/[^/]+$/, () => d.perpetual],
  [/^\/perpetuals\/[^/]+\/state$/, () => d.perpetualState],
  [/^\/perpetuals\/[^/]+\/price$/, () => ({ yesBps: 5000, noBps: 5000 })],
  [/^\/perpetuals\/[^/]+\/fee$/, () => d.fee],
  [/^\/perpetuals\/[^/]+\/position$/, () => d.position],
  [/^\/prices\/[^/]+$/, () => ({ priceCents: '25', publishTime: Math.floor(Date.now() / 1000) })],
  [/^\/wallets\/balance$/, () => d.balance],
];

/**
 * Serves every oracle call from fixtures. `overrides` replaces a path's
 * body for one test (e.g. `{ '/markets': [] }` for the empty state).
 * The email-session probe answers 401 — the "not signed in" state.
 */
export async function mockOracle(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route(`${MOCK_ORACLE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': route.request().headers().origin ?? '*', 'access-control-allow-credentials': 'true' };
    if (url.pathname in overrides) {
      return route.fulfill({ json: overrides[url.pathname], headers });
    }
    if (url.pathname.startsWith('/auth/email/me') || url.pathname.startsWith('/admin/')) {
      return route.fulfill({ status: 401, json: { message: 'Unauthorized' }, headers });
    }
    const hit = routes.find(([re]) => re.test(url.pathname));
    if (!hit) return route.fulfill({ status: 404, json: { message: `No fixture for ${url.pathname}` }, headers });
    return route.fulfill({ json: hit[1](url, route), headers });
  });
}
