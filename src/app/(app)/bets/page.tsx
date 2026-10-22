'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-provider';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { centsToUsd, stroopsToXlm } from '@/lib/format';
import { didWin, markToMarket, redeemableValue, type MarketStatus } from '@/lib/portfolio';

function PositionRow({ contractId }: { contractId: string }) {
  const { wallet } = useWallet();
  const { data: market } = useQuery({ queryKey: ['market', contractId], queryFn: () => api.getMarket(contractId) });
  const { data: state } = useQuery({ queryKey: ['state', contractId], queryFn: () => api.getMarketState(contractId) });
  const { data: position } = useQuery({
    queryKey: ['position', contractId, wallet?.address],
    queryFn: () => api.getPosition(contractId, wallet!.address),
    enabled: !!wallet,
  });
  const { data: price } = useQuery({
    queryKey: ['price', contractId],
    queryFn: () => api.getPrice(contractId),
    enabled: state?.status === 'Open',
  });

  if (!market || !state || !position) return null;
  const pos = { yes: BigInt(position.yes), no: BigInt(position.no) };
  if (pos.yes === 0n && pos.no === 0n) return null;

  const status = state.status as MarketStatus;
  const value =
    status === 'Open' && price ? markToMarket(pos, price.yesBps, price.noBps) : redeemableValue(status, pos);
  const win = didWin(status, pos);

  return (
    <Link href={`/market/${contractId}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">
              Will XLM be ≥ {centsToUsd(market.strikePriceCents)}?
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {stroopsToXlm(pos.yes)} YES / {stroopsToXlm(pos.no)} NO
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{stroopsToXlm(value)} XLM</div>
            <div className="mt-1">
              {win === true && <Badge tone="yes">won</Badge>}
              {win === false && <Badge tone="no">lost</Badge>}
              {win === null && <Badge tone={status === 'Open' ? 'accent' : 'neutral'}>{status === 'Open' ? 'mark-to-market' : status.toLowerCase()}</Badge>}
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

/**
 * Perpetual analogue of `PositionRow` above — same shape, backed by the
 * parallel `/perpetuals` endpoint set (see `src/lib/api.ts`'s doc comment
 * on `WatchedPerpetual` for why this is a separate type/row rather than a
 * `market`-shaped union). A perpetual only ever has two states on-chain
 * (`Open`/`Terminated`, no strike/expiry/settle), so unlike a classic
 * market there's no resolved-yes/no outcome — just mark-to-market while
 * open, or the fixed termination payout once closed.
 */
function PerpetualPositionRow({ contractId }: { contractId: string }) {
  const { wallet } = useWallet();
  const { data: perpetual } = useQuery({
    queryKey: ['perpetual', contractId],
    queryFn: () => api.getPerpetual(contractId),
  });
  const { data: state } = useQuery({
    queryKey: ['perpetualState', contractId],
    queryFn: () => api.getPerpetualState(contractId),
  });
  const { data: position } = useQuery({
    queryKey: ['perpetualPosition', contractId, wallet?.address],
    queryFn: () => api.getPerpetualPosition(contractId, wallet!.address),
    enabled: !!wallet,
  });
  const { data: price } = useQuery({
    queryKey: ['perpetualPrice', contractId],
    queryFn: () => api.getPerpetualPrice(contractId),
    enabled: state?.status === 'Open',
  });

  if (!perpetual || !state || !position) return null;
  const pos = { yes: BigInt(position.yes), no: BigInt(position.no) };
  if (pos.yes === 0n && pos.no === 0n) return null;

  const isOpen = state.status === 'Open';
  // `Terminated` pays out the exact same 0.5-collateral-per-complementary-
  // pair formula as a classic market's `Cancelled` case (see
  // `PerpetualTradeCard`'s doc comment on `canRedeem`, and
  // `polaris-contracts/README.md`'s "The perpetual contract") —
  // `redeemableValue` only knows the classic-market status union, so
  // `'Cancelled'` is the equivalent case here, not a re-derivation of the
  // same math.
  const value = isOpen && price ? markToMarket(pos, price.yesBps, price.noBps) : redeemableValue('Cancelled', pos);

  return (
    <Link href={`/perpetual/${contractId}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">XLM/USD perpetual</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {stroopsToXlm(pos.yes)} YES / {stroopsToXlm(pos.no)} NO
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{stroopsToXlm(value)} XLM</div>
            <div className="mt-1">
              <Badge tone={isOpen ? 'accent' : 'neutral'}>{isOpen ? 'mark-to-market' : 'terminated'}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export default function PortfolioPage() {
  const { wallet } = useWallet();
  const { data: markets } = useQuery({ queryKey: ['markets'], queryFn: api.listMarkets });
  const { data: perpetuals } = useQuery({ queryKey: ['perpetuals'], queryFn: api.listPerpetuals });

  if (!wallet) {
    return <p className="text-sm text-[var(--muted)]">Sign in with a passkey to see your positions.</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Portfolio</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Values are marked at current implied price for open markets, or exact redeemable value once a
        market resolves or is cancelled — see{' '}
        <Link href="/docs" className="underline">
          docs
        </Link>{' '}
        for what this build does and doesn&rsquo;t track.
      </p>
      <div className="space-y-3">
        {markets?.map((m) => <PositionRow key={m.contractId} contractId={m.contractId} />)}
        {perpetuals?.map((p) => <PerpetualPositionRow key={p.contractId} contractId={p.contractId} />)}
      </div>
    </div>
  );
}
