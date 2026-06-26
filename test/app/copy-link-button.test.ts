import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { h } from '@builder.io/qwik';
import CopyLinkButton from '../../src/components/copy-link-button';

describe('CopyLinkButton', () => {
  it('renders a Copy link button in its initial state', async () => {
    const { screen, render } = await createDOM();
    await render(h(CopyLinkButton, {}));
    expect(screen.outerHTML).toContain('Copy link');
  });
});
