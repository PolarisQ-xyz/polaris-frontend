'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { shortAddress, stroopsToXlm } from '@/lib/format';

const STEP_LABEL: Record<string, string> = {
  passkey: 'Confirm with Face ID / Touch ID…',
  deploying: 'Setting up your account…',
  done: 'Ready',
};

/**
 * The full sign-in state machine — passkey (one click) with an email
 * fallback (see `EmailAuthService`'s doc comment in polaris-oracle for why
 * that exists), plus sign-out once a wallet exists. Shared between the
 * header (`(app)/layout.tsx`) and the embed widget rather than duplicated,
 * since the state machine itself (five distinct phases: signed-in,
 * passkey-in-flight, email-idle, email-code-sent, signed-out) is identical
 * between them — only sizing differs, via `compact`.
 */
export function AuthControls({ compact = false }: { compact?: boolean }) {
  const {
    wallet,
    connecting,
    creationStep,
    webauthnSupported,
    createWallet,
    cancelCreation,
    emailStep,
    emailBusy,
    requestEmailCode,
    verifyEmailCode,
    resetEmailFlow,
    logout,
  } = useWallet();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const { data: balance } = useQuery({
    queryKey: ['walletBalance', wallet?.address],
    queryFn: () => api.getBalance(wallet!.address),
    enabled: !!wallet,
    refetchInterval: 20_000,
  });

  const linkClass = `${compact ? 'text-[10px]' : 'text-[11px]'} text-[var(--muted)] underline hover:text-[var(--ink)]`;
  const inputClass = `h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 ${compact ? 'text-xs' : 'text-xs'}`;
  const btnSize = compact ? 'sm' : 'sm';

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        {balance && (
          <span className="text-xs font-mono text-[var(--muted)]">{stroopsToXlm(balance.balanceStroops)} XLM</span>
        )}
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-mono">
          {shortAddress(wallet.address)}
        </span>
        <button type="button" onClick={logout} className={linkClass}>
          Sign out
        </button>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size={btnSize} disabled>
          {creationStep ? STEP_LABEL[creationStep] : 'Creating…'}
        </Button>
        <button type="button" onClick={cancelCreation} className={linkClass}>
          Cancel
        </button>
      </div>
    );
  }

  const effectiveShowEmail = showEmail || !webauthnSupported;

  if (effectiveShowEmail) {
    if (emailStep === 'code-sent') {
      return (
        <form
          className="flex flex-col items-end gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void verifyEmailCode(email, code);
          }}
        >
          <div className="flex items-center gap-2">
            <input
              autoFocus
              disabled={emailBusy}
              className={`${inputClass} w-24 disabled:opacity-60`}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <Button size={btnSize} type="submit" disabled={emailBusy || code.length !== 6}>
              {emailBusy ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCode('');
              resetEmailFlow();
            }}
            className={linkClass}
          >
            Use a different email
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
        {webauthnSupported && (
          <button type="button" onClick={() => setShowEmail(false)} className={linkClass}>
            Use a passkey instead
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size={btnSize} onClick={() => void createWallet('polaris-bettor')}>
        {compact ? 'Sign in with passkey' : (
          <>
            <span className="sm:hidden">Sign in</span>
            <span className="hidden sm:inline">Sign in with passkey</span>
          </>
        )}
      </Button>
      <button type="button" onClick={() => setShowEmail(true)} className={linkClass}>
        or use email
      </button>
    </div>
  );
}
