import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, PAYLOAD_VERSION } from '../../src/codec/state';
import { InvalidPayloadError } from '../../src/codec/errors';

describe('state codec', () => {
  it('round-trips NSG-like text', async () => {
    const text = 'LTE RRC Signaling Messages\n  bandEUTRA : 20\n'.repeat(100);
    expect(await decodeState(await encodeState(text))).toBe(text);
  });

  it('round-trips unicode', async () => {
    const text = 'señal 📶 测试 — rohc';
    expect(await decodeState(await encodeState(text))).toBe(text);
  });

  it('prefixes the payload with the version', async () => {
    const payload = await encodeState('x');
    expect(payload[0]).toBe(PAYLOAD_VERSION);
  });

  it('rejects an empty payload', async () => {
    await expect(decodeState('')).rejects.toBeInstanceOf(InvalidPayloadError);
  });

  it('rejects an unknown version', async () => {
    await expect(decodeState('9ABCDEF')).rejects.toBeInstanceOf(InvalidPayloadError);
  });

  it('rejects corrupt base32 body', async () => {
    await expect(decodeState('1@@@@')).rejects.toBeInstanceOf(InvalidPayloadError);
  });

  it('rejects valid base32 whose bytes are not a DEFLATE stream', async () => {
    // '1' version + base32('foobar') — decodes to bytes that are not valid raw DEFLATE
    await expect(decodeState('1MZXW6YTBOI')).rejects.toBeInstanceOf(InvalidPayloadError);
  });
});
