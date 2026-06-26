import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { h } from '@builder.io/qwik';
import ThemeToggle from '../../src/components/theme-toggle';

describe('ThemeToggle', () => {
  it('renders System/Light/Dark in a Theme group, System pressed by default', async () => {
    const { screen, render } = await createDOM();
    await render(h(ThemeToggle, {}));
    const html = screen.outerHTML;
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain('System');
    expect(html).toContain('Light');
    expect(html).toContain('Dark');
    // The default selection (System) renders one pressed button.
    expect(html).toContain('aria-pressed="true"');
  });
});
