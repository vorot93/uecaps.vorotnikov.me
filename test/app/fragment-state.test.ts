/**
 * Unit tests for loadFromFragment / writeFragment.
 *
 * Runs in Node env (Vitest default). We test loadFromFragment + the encode
 * path directly (encodeState → toFragment → loadFromFragment) to avoid
 * touching the `history` browser global. For writeFragment we stub
 * globalThis.history so it can be exercised without a DOM.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encodeState } from '../../src/codec';
import { loadFromFragment, writeFragment } from '../../src/lib/fragment-state';

describe('loadFromFragment', () => {
  it('returns null for an empty string', async () => {
    expect(await loadFromFragment('')).toBeNull();
  });

  it('returns null for a hash with no recognised key', async () => {
    expect(await loadFromFragment('#nope')).toBeNull();
  });

  it('returns null for a hash with a garbage payload', async () => {
    // "d=" key present but the value is not a valid compressed payload
    expect(await loadFromFragment('#d=NOTVALIDPAYLOAD!!!!')).toBeNull();
  });

  it('round-trips: encode then loadFromFragment recovers the original text', async () => {
    const original = 'rat-Type : nr\n';
    const payload = await encodeState(original);
    const hash = `#d=${payload}`;
    const recovered = await loadFromFragment(hash);
    expect(recovered).toBe(original);
  });

  it('round-trips a multi-line NSG-like text', async () => {
    const original = 'rat-Type : eutra\nband : 3\nband : 7\n';
    const payload = await encodeState(original);
    const recovered = await loadFromFragment(`#d=${payload}`);
    expect(recovered).toBe(original);
  });
});

describe('writeFragment', () => {
  const originalHistory = globalThis.history;

  beforeEach(() => {
    // Stub globalThis.history so writeFragment doesn't throw in Node
    const stub = {
      replaceState: vi.fn(),
      // minimal surface — the function only calls replaceState
    };
    // @ts-expect-error — intentional partial stub of the browser History API
    globalThis.history = stub;
  });

  afterEach(() => {
    globalThis.history = originalHistory;
  });

  it('calls history.replaceState with a #d= fragment', async () => {
    const text = 'rat-Type : nr\n';
    await writeFragment(text);

    const replaceState = (globalThis.history as unknown as { replaceState: ReturnType<typeof vi.fn> }).replaceState;
    expect(replaceState).toHaveBeenCalledOnce();

    const [stateArg, titleArg, urlArg] = replaceState.mock.calls[0] as [unknown, unknown, string];
    expect(stateArg).toBeNull();
    expect(titleArg).toBe('');
    expect(urlArg).toMatch(/^#d=/);
  });

  it('produces a URL that loadFromFragment can decode back to the original text', async () => {
    const text = 'rat-Type : eutra\nband : 1\n';
    await writeFragment(text);

    const replaceState = (globalThis.history as unknown as { replaceState: ReturnType<typeof vi.fn> }).replaceState;
    const [, , fragment] = replaceState.mock.calls[0] as [unknown, unknown, string];
    const recovered = await loadFromFragment(fragment);
    expect(recovered).toBe(text);
  });
});
