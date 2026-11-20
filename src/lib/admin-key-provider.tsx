'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, isUnauthorized } from './api';

const STORAGE_KEY = 'polaris.adminKey';

export type AdminKeyStatus = 'unset' | 'checking' | 'valid' | 'invalid';

interface AdminKeyContextValue {
  adminKey: string;
  setAdminKey: (key: string) => void;
  /**
   * `'unset'` — no key entered yet, no probe made (matches the old
   * `use-admin-key.ts` disablement idiom: no network call before a key
   * exists). `'checking'` — a probe is in flight. `'valid'`/`'invalid'` —
   * the last probe's result for the *current* key value.
   */
  status: AdminKeyStatus;
}

const AdminKeyContext = createContext<AdminKeyContextValue | null>(null);

/**
 * Scoped to the `/admin/*` tree only — deliberately separate from
 * `lib/use-admin-key.ts`, which `(app)/create/page.tsx` still uses
 * unchanged. Promoting that hook into a shared context was in scope for
 * the admin dashboard rebuild; touching `/create` (a different page this
 * work wasn't asked to change) wasn't.
 *
 * New behavior, not a promotion of old behavior: today's flat admin page
 * does zero gating (just disables buttons on an empty key) and lets a bad
 * key 401 inline per action. This gates the *whole* `/admin/*` tree behind
 * one probe. Still just a convenience gate, not a security boundary — the
 * key lives in the same `sessionStorage`, readable via devtools exactly as
 * before; real enforcement stays 100% server-side in `AdminGuard`.
 */
export function AdminKeyProvider({ children }: { children: React.ReactNode }) {
  const [adminKey, setAdminKeyState] = useState('');
  const [status, setStatus] = useState<AdminKeyStatus>('unset');

  useEffect(() => {
    // Same hydration-mismatch reasoning as use-admin-key.ts: sessionStorage
    // is only readable client-side, so this can't be a lazy initializer.
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setAdminKeyState(stored);
  }, []);

  useEffect(() => {
    // Resets status when the key is cleared (e.g. logout) — a deliberate
    // synchronous transition, same accepted pattern already suppressed in
    // wallet-provider.tsx and use-admin-key.ts, not an accidental
    // render-triggering setState. (Arming 'checking' below, right before
    // kicking off the async probe, isn't flagged by the same rule.)
    if (!adminKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('unset');
      return;
    }
    let cancelled = false;
    setStatus('checking');
    api.getAdminOverview(adminKey).then(
      () => {
        if (!cancelled) setStatus('valid');
      },
      (err) => {
        if (cancelled) return;
        // Only a real 401 gates the dashboard closed. Anything else (the
        // backend down, a network blip) must not read as "bad key" — same
        // "an availability check must never become a new way to block
        // something" rule this codebase already applies elsewhere (the
        // oracle cross-check, the wallet-deploy rate limiter). Individual
        // section pages still surface that failure on their own.
        setStatus(isUnauthorized(err) ? 'invalid' : 'valid');
      },
    );
    return () => {
      cancelled = true;
    };
    // Re-probe only when the key value changes, not on every sibling-page
    // navigation within /admin/* — this provider lives in admin/layout.tsx,
    // which stays mounted across those transitions.
  }, [adminKey]);

  const setAdminKey = useCallback((key: string) => {
    setAdminKeyState(key);
    window.sessionStorage.setItem(STORAGE_KEY, key);
  }, []);

  return (
    <AdminKeyContext.Provider value={{ adminKey, setAdminKey, status }}>{children}</AdminKeyContext.Provider>
  );
}

export function useAdminKey(): AdminKeyContextValue {
  const ctx = useContext(AdminKeyContext);
  if (!ctx) throw new Error('useAdminKey must be used within AdminKeyProvider');
  return ctx;
}
