'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'polaris.adminKey';

/** Session-only (sessionStorage, not localStorage) admin API key entry — never sent anywhere but this app's own backend, never persisted past the browser tab closing. */
export function useAdminKey() {
  const [adminKey, setAdminKey] = useState('');

  useEffect(() => {
    // Deliberately NOT a lazy useState initializer, despite what the
    // set-state-in-effect lint rule suggests: this page is server-rendered
    // first (empty state, matching what the server can know), and
    // sessionStorage is only readable client-side. Reading it in the
    // initializer would make the client's first hydration pass render a
    // different value than the server did — a real hydration mismatch, not
    // just an extra render. The effect's one extra render is the price of
    // avoiding that.
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setAdminKey(stored);
  }, []);

  function update(key: string) {
    setAdminKey(key);
    window.sessionStorage.setItem(STORAGE_KEY, key);
  }

  return { adminKey, setAdminKey: update };
}
