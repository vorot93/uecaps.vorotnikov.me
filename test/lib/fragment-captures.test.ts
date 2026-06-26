import { describe, it, expect } from 'vitest';
import { loadCapturesFromFragment } from '../../src/lib/fragment-state';
import { encodeState, toFragment } from '../../src/codec';
import { readFixtureText } from '../parser/harness';

describe('loadCapturesFromFragment', () => {
  it('round-trips a captures array encoded through the codec', async () => {
    const captures = [
      { name: 'A', text: 'first device text' },
      { name: '', text: 'second device text' },
    ];
    const frag = toFragment(await encodeState(JSON.stringify(captures)));
    const r = await loadCapturesFromFragment(frag);
    expect(r.decodeError).toBeNull();
    expect(r.captures).toEqual(captures);
  });

  it('decodes a legacy single-blob (raw NSG text) link as one unnamed capture', async () => {
    const raw = readFixtureText('nsgNr.input.txt');
    const frag = toFragment(await encodeState(raw)); // legacy shape: raw text, not JSON
    const r = await loadCapturesFromFragment(frag);
    expect(r.decodeError).toBeNull();
    expect(r.captures).toEqual([{ name: '', text: raw }]);
  });

  it('returns { null, null } for an empty hash (no fragment)', async () => {
    const r = await loadCapturesFromFragment('');
    expect(r.captures).toBeNull();
    expect(r.decodeError).toBeNull();
  });

  it('returns { null, null } for a hash with no d= key', async () => {
    const r = await loadCapturesFromFragment('#nope');
    expect(r.captures).toBeNull();
    expect(r.decodeError).toBeNull();
  });

  it('returns a decodeError for a corrupt d= payload', async () => {
    const r = await loadCapturesFromFragment('#d=NOTVALIDPAYLOAD!!!!');
    expect(r.captures).toBeNull();
    expect(r.decodeError).toBe('This share link is corrupted or unsupported.');
  });
});
