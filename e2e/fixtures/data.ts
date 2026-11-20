export const MARKET_ID = 'CMARKETFIXTURE0000000000000000000000000000000000000000000';
export const PERP_ID = 'CPERPFIXTURE00000000000000000000000000000000000000000000';
export const TEST_ADDRESS = 'GTESTADDRESSFIXTURE000000000000000000000000000000000000';

const now = Date.now();

export const market = {
  contractId: MARKET_ID,
  strikePriceCents: '25',
  expiry: Math.floor(now / 1000) + 86_400,
  gracePeriodSecs: 3600,
  feedId: 1,
  status: 'watching',
  createdAt: now,
  updatedAt: now,
};

export const marketState = {
  admin: TEST_ADDRESS,
  collateral: 'CCOLLATERAL',
  strikePrice: '25',
  expiry: String(market.expiry),
  gracePeriod: '3600',
  lazerContract: 'CLAZER',
  feedId: 1,
  baseFeeBps: 100,
  minFeeBps: 10,
  treasury: TEST_ADDRESS,
  status: 'Open',
  finalPrice: '0',
  poolYes: '10000000000',
  poolNo: '10000000000',
  totalSupply: '20000000000',
  initialLiquidity: '20000000000',
};

export const perpetual = { contractId: PERP_ID, status: 'watching', createdAt: now, updatedAt: now };

export const perpetualState = {
  admin: TEST_ADDRESS,
  collateral: 'CCOLLATERAL',
  baseFeeBps: 100,
  minFeeBps: 10,
  treasury: TEST_ADDRESS,
  status: 'Open',
  poolYes: '10000000000',
  poolNo: '10000000000',
  totalSupply: '20000000000',
  initialLiquidity: '20000000000',
  lastPriceCents: '0',
  lastPriceAt: '0',
};

export const price = { yesBps: 5000, noBps: 5000, yesBpsChange: null };
export const fee = { feeBps: 100 };
export const position = { yes: '0', no: '0' };
export const balance = { balanceStroops: '100000000' };
