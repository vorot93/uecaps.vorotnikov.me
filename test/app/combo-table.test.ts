import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { h } from '@builder.io/qwik';
import ComboTable from '../../src/components/table/combo-table';

describe('ComboTable defaultOpen', () => {
  it('renders an open <details> when defaultOpen is true', async () => {
    const { screen, render } = await createDOM();
    await render(
      h(ComboTable, { title: 'X', headers: ['A'], data: [['1']], hideEmpty: false, defaultOpen: true }),
    );
    expect(screen.outerHTML).toMatch(/<details[^>]*\bopen/);
  });

  it('renders a collapsed <details> when defaultOpen is omitted', async () => {
    const { screen, render } = await createDOM();
    await render(
      h(ComboTable, { title: 'X', headers: ['A'], data: [['1']], hideEmpty: false }),
    );
    expect(screen.outerHTML).not.toMatch(/<details[^>]*\bopen/);
  });
});
