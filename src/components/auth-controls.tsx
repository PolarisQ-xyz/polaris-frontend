'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { shortAddress } from '@/lib/format';
import { useFormatStroops } from '@/lib/display-currency';
import { qk } from '@/lib/query-keys';

/** Backend rate-limits OTP requests; keep the resend link disabled for this long after each successful send so the user isn't just bouncing off that limit. */
const RESEND_COOLDOWN_SECS = 30;

type EmailStep = 'idle' | 'code-sent';

export function AuthControls() {
  const formatStroops = useFormatStroops();
  const { address, email, connectEmail, disconnect } = useWallet();
  const [emailStep, setEmailStep] = useState<EmailStep>('idle');
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const { data: balance } = useQuery({
    queryKey: qk.wallet.balance(wallet?.address),
    queryFn: () => api.getBalance(wallet!.address),
    enabled: !!wallet,
    refetchInterval: 20_000,
  });

  function resetEmailFlow() {
    setEmailStep('idle');
    setCodeInput('');
    setError(null);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = null;
    setCooldown(0);
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {balance && (
          <span className="text-xs font-mono text-[var(--muted)]">
            {formatStroops(balance.balanceStroops)}
          </span>
        )}
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-mono">
          {shortAddress(wallet.address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded border border-neutral-700 px-3 py-1 text-xs hover:border-neutral-500"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (emailStep === 'code-sent') {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-2 text-sm">
        <p className="text-xs text-neutral-400">
          We sent a code to <span className="font-mono">{emailInput}</span>.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          className="rounded border border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !codeInput}
            className="rounded bg-white px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={busy || cooldown > 0}
            className="text-xs text-neutral-400 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      );
    }

    return (
      <form
        className="flex flex-col items-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void requestEmailCode(email);
        }}
      >
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="email"
            disabled={emailBusy}
            className={`${inputClass} w-36 disabled:opacity-60`}
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button size={btnSize} type="submit" disabled={emailBusy || !email}>
            {emailBusy ? 'Sending…' : 'Send code'}
          </Button>
        </div>
        {freighterAvailable === false ? (
          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Don&rsquo;t have Freighter? Install it →
          </a>
        ) : (
          <button type="button" onClick={() => setShowEmail(false)} className={linkClass}>
            Use a wallet instead
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestCode} className="flex flex-col gap-2 text-sm">
      <input
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        className="rounded border border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !emailInput}
        className="rounded bg-white px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
      >
        {compact ? (
          'Connect Wallet'
        ) : (
          <>
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Wallet</span>
          </>
        )}
      </Button>
      {firstTimeIntent && (
        <p className="max-w-[220px] text-right text-[11px] text-[var(--muted)]">
          Connects Freighter — sign every trade yourself, no custodial account.
        </p>
      )}
      <button type="button" onClick={() => setShowEmail(true)} className={linkClass}>
        or use email
      </button>
    </form>
  );
}
