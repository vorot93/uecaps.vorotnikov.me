import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { h, $ } from '@builder.io/qwik';
import CaptureCard from '../../src/components/capture-card';

const handlers = {
  onNameChange$: $(() => {}),
  onTextChange$: $(() => {}),
  onRemove$: $(() => {}),
};

describe('CaptureCard', () => {
  it('renders the 1-based heading and the name placeholder', async () => {
    const { screen, render } = await createDOM();
    await render(h(CaptureCard, { index: 2, name: '', text: '', canRemove: true, ...handlers }));
    const html = screen.outerHTML;
    expect(html).toContain('Capture 3');
    expect(html).toContain('Pixel 8'); // from the name input placeholder
  });

  it('renders a red role="alert" error when error is set', async () => {
    const { screen, render } = await createDOM();
    await render(
      h(CaptureCard, { index: 0, name: '', text: '', error: 'Failed to parse the pasted text.', canRemove: true, ...handlers }),
    );
    const html = screen.outerHTML;
    expect(html).toContain('role="alert"');
    expect(html).toContain('Failed to parse the pasted text.');
  });

  it('renders a yellow role="status" warnings banner when warnings are present', async () => {
    const { screen, render } = await createDOM();
    await render(
      h(CaptureCard, { index: 0, name: '', text: '', warnings: ['Skipped unsupported capability: UTRA'], canRemove: true, ...handlers }),
    );
    const html = screen.outerHTML;
    expect(html).toContain('role="status"');
    expect(html).toContain('Skipped unsupported capability: UTRA');
  });

  it('shows the Remove button when canRemove is true', async () => {
    const { screen, render } = await createDOM();
    await render(h(CaptureCard, { index: 0, name: '', text: '', canRemove: true, ...handlers }));
    expect(screen.outerHTML).toContain('Remove');
  });

  it('omits the Remove button when canRemove is false', async () => {
    const { screen, render } = await createDOM();
    await render(h(CaptureCard, { index: 0, name: '', text: '', canRemove: false, ...handlers }));
    expect(screen.outerHTML).not.toContain('Remove');
  });
});
