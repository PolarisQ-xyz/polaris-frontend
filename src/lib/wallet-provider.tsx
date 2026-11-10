'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { connectFreighter, getConnectedAddress, isFreighterAvailable, type StoredWallet } from './freighter-wallet';
import { api, messageFromApiError } from './api';

interface WalletContextValue {
  wallet: StoredWallet | null;
  connecting: boolean;
  error: string | null;
  /** `false` only once we've actually checked and found no Freighter extension — lets the UI nudge toward installing it instead of showing a button that would just fail. `null` while that check is still in flight. */
  freighterAvailable: boolean | null;
  connectWallet: () => Promise<StoredWallet | null>;

  // Email fallback — see `EmailAuthService`'s doc comment in polaris-oracle
  // for why this exists (no-extension browsers/devices).
  emailStep: 'idle' | 'code-sent';
  emailBusy: boolean;
  requestEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<StoredWallet | null>;
  resetEmailFlow: () => void;

  logout: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freighterAvailable, setFreighterAvailable] = useState<boolean | null>(null);
  const [emailStep, setEmailStep] = useState<'idle' | 'code-sent'>('idle');
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    // Deliberately NOT a lazy useState initializer, despite what the
    // set-state-in-effect lint rule suggests: this provider wraps
    // server-rendered pages, and the Freighter extension (like
    // WebAuthn before it) only exists client-side. Reading it in the
    // initializer would make the client's first hydration pass render
    // different wallet-gated UI than the server did — a real hydration
    // mismatch, not just an extra render.
    isFreighterAvailable().then((available) => {
      setFreighterAvailable(available);
    });

    // Freighter first (silent — no prompt, just asks the extension whether
    // this origin is already authorized), then fall back to an existing
    // email session (an httpOnly cookie, so this is the only way to
    // discover it). A connected Freighter wallet always wins if both
    // somehow exist, same precedence as the connect flow itself.
    getConnectedAddress().then((address) => {
      if (address) {
        setWallet({ kind: 'freighter', address });
        return;
      }
      api
        .getEmailSession()
        .then(({ address: emailAddress }) => setWallet({ kind: 'email', address: emailAddress }))
        .catch(() => {
          // No session either — signed out, which is the default state anyway.
        });
    });
  }, []);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await connectFreighter();
      const w: StoredWallet = { kind: 'freighter', address };
      setWallet(w);
      return w;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const requestEmailCode = useCallback(async (email: string) => {
    setEmailBusy(true);
    setError(null);
    try {
      await api.requestEmailCode(email);
      setEmailStep('code-sent');
      return true;
    } catch (err) {
      setError(messageFromApiError(err));
      return false;
    } finally {
      setEmailBusy(false);
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    setEmailBusy(true);
    setError(null);
    try {
      const { address } = await api.verifyEmailCode(email, code);
      const w: StoredWallet = { kind: 'email', address };
      setWallet(w);
      setEmailStep('idle');
      return w;
    } catch (err) {
      setError(messageFromApiError(err));
      return null;
    } finally {
      setEmailBusy(false);
    }
  }, []);

  const resetEmailFlow = useCallback(() => {
    setEmailStep('idle');
    setError(null);
  }, []);

  const logout = useCallback(() => {
    // Freighter has no programmatic "revoke" call — forgetting the address
    // client-side is the only disconnect this app can do; the extension
    // itself still remembers it authorized this origin until the user
    // revokes that from Freighter's own UI.
    void api.emailLogout().catch(() => {});
    setWallet(null);
    setEmailStep('idle');
    setError(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        connecting,
        error,
        freighterAvailable,
        connectWallet,
        emailStep,
        emailBusy,
        requestEmailCode,
        verifyEmailCode,
        resetEmailFlow,
        logout,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
