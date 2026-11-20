import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

/** Minimal dependency-free render for jsdom specs (`// @vitest-environment jsdom`). */
export async function render(ui: ReactNode): Promise<HTMLElement> {
  cleanup();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(ui));
  return container;
}

export function cleanup() {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
}

export function getButton(text: string | RegExp): HTMLButtonElement {
  const match = (s: string) => (typeof text === 'string' ? s.trim() === text : text.test(s));
  const btn = Array.from(document.querySelectorAll('button')).find((b) => match(b.textContent ?? ''));
  if (!btn) throw new Error(`No button matching ${text}`);
  return btn;
}

export function queryButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text);
}

export async function click(el: HTMLElement) {
  await act(async () => el.click());
}

/** Sets a controlled input's value so React's onChange fires. */
export async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function text(): string {
  return document.body.textContent ?? '';
}
