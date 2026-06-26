import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { h, $ } from '@builder.io/qwik';
import EmptyState from '../../src/components/empty-state';

describe('EmptyState', () => {
  it('renders the explainer and a Load example button', async () => {
    const { screen, render } = await createDOM();
    await render(h(EmptyState, { onLoadExample$: $(() => {}) }));
    const html = screen.outerHTML;
    expect(html).toContain('Load example');
    expect(html).toContain('ueCapabilityInformation');
  });
});
