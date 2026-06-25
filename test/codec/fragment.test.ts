import { describe, it, expect } from 'vitest';
import { toFragment, parseFragment } from '../../src/codec/fragment';
import { encodeState, decodeState } from '../../src/codec/index';

describe('fragment helpers', () => {
  it('builds a #d= fragment', () => {
    expect(toFragment('1ABC')).toBe('#d=1ABC');
  });

  it('parses a payload from a hash with leading #', () => {
    expect(parseFragment('#d=1ABC')).toBe('1ABC');
  });

  it('parses a hash without the leading #', () => {
    expect(parseFragment('d=1ABC')).toBe('1ABC');
  });

  it('returns null when there is no d= value', () => {
    expect(parseFragment('')).toBeNull();
    expect(parseFragment('#')).toBeNull();
    expect(parseFragment('#other=1')).toBeNull();
  });

  it('survives a full encode -> fragment -> parse -> decode trip', async () => {
    const text = 'rat-Type : nr\n  bandNR : 78\n';
    const hash = toFragment(await encodeState(text));
    const payload = parseFragment(hash);
    expect(payload).not.toBeNull();
    expect(await decodeState(payload!)).toBe(text);
  });
});
