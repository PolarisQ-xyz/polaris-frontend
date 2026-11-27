import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; container: HTMLElement }[] = [];

/** Minimal render helper (no @testing-library dependency): mounts inside `act` and returns the container. */
export async function render(ui: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  mounted.push({ root, container });
  return {
    container,
    rerender: (next: ReactElement) => act(async () => root.render(next)),
  };
}

export function cleanup() {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
}

/** Lets pending promises/effects settle inside `act`. */
export async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

export function byText(container: HTMLElement, text: string | RegExp): HTMLElement | null {
  const els = Array.from(container.querySelectorAll<HTMLElement>('button, a, p, span, label'));
  return els.find((el) => (typeof text === 'string' ? el.textContent?.trim() === text : text.test(el.textContent ?? ''))) ?? null;
}

/** All rendered text in the document — for asserting on messages without a container. */
export function text(): string {
  return document.body.textContent ?? '';
}

/** The button whose trimmed text is exactly `label`; throws when absent so a typo fails loudly. */
export function getButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(
    (el) => el.textContent?.trim() === label,
  );
  if (!button) throw new Error(`getButton: no button labelled "${label}"`);
  return button;
}

export async function click(el: Element | null) {
  if (!el) throw new Error('click: element not found');
  await act(async () => {
    (el as HTMLElement).click();
  });
}

/** Sets a controlled input's value the way React's onChange expects. */
export async function type(el: Element | null, value: string) {
  if (!el) throw new Error('type: element not found');
  const input = el as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
