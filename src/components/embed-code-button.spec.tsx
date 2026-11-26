// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbedCodeButton } from './embed-code-button';
import '@/test/render';

describe('EmbedCodeButton', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('server-renders the button without window and hydrates cleanly', async () => {
    vi.stubGlobal('window', undefined);
    const html = renderToString(<EmbedCodeButton contractId="C1" />);
    vi.unstubAllGlobals();
    expect(html).toContain('Get embed code');

    const container = document.createElement('div');
    container.innerHTML = html;
    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, <EmbedCodeButton contractId="C1" />, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();

    await act(async () =>
      container.querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true })),
    );
    expect(container.querySelector('pre')?.textContent).toContain(`${window.location.origin}/embed/C1`);
    await act(async () => root.unmount());
  });
});
