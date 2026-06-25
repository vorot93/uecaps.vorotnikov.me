import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode } from '../../src/codec/base32';

const enc = (s: string) => base32Encode(new TextEncoder().encode(s));
const dec = (s: string) => new TextDecoder().decode(base32Decode(s));

describe('base32', () => {
  it('encodes the RFC 4648 vectors without padding', () => {
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('MY');
    expect(enc('fo')).toBe('MZXQ');
    expect(enc('foo')).toBe('MZXW6');
    expect(enc('foob')).toBe('MZXW6YQ');
    expect(enc('fooba')).toBe('MZXW6YTB');
    expect(enc('foobar')).toBe('MZXW6YTBOI');
  });

  it('decodes case-insensitively and tolerates padding', () => {
    expect(dec('MZXW6YTBOI')).toBe('foobar');
    expect(dec('mzxw6ytboi')).toBe('foobar');
    expect(dec('MZXW6YTBOI======')).toBe('foobar');
  });

  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64, 32]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('throws on invalid characters', () => {
    expect(() => base32Decode('0189')).toThrow();
  });
});
