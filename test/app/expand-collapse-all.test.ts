import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { component$, useSignal, h } from '@builder.io/qwik';
import ExpandCollapseAll from '../../src/components/table/expand-collapse-all';

// A tiny host supplies a real Qwik ref signal for the `target` prop.
const Host = component$(() => {
  const ref = useSignal<HTMLElement>();
  return h('div', { ref }, h(ExpandCollapseAll, { target: ref }));
});

describe('ExpandCollapseAll', () => {
  it('renders Expand all and Collapse all buttons', async () => {
    const { screen, render } = await createDOM();
    await render(h(Host, {}));
    const html = screen.outerHTML;
    expect(html).toContain('Expand all');
    expect(html).toContain('Collapse all');
  });
});
