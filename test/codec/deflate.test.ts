import { describe, it, expect, vi } from 'vitest';
import { deflate, inflate } from '../../src/codec/deflate';
import { deflateSync, inflateSync } from 'fflate';

const text = 'rat-Type : eutra\n'.repeat(500); // compressible, NSG-like

describe('deflate', () => {
  it('round-trips data', async () => {
    const input = new TextEncoder().encode(text);
    const out = await inflate(await deflate(input));
    expect(out).toEqual(input);
  });

  it('actually compresses repetitive input', async () => {
    const input = new TextEncoder().encode(text);
    const compressed = await deflate(input);
    expect(compressed.length).toBeLessThan(input.length / 5);
  });

  it('our inflate reads fflate-produced raw DEFLATE', async () => {
    const input = new TextEncoder().encode(text);
    const out = await inflate(deflateSync(input));
    expect(out).toEqual(input);
  });

  it('fflate reads our deflate output', async () => {
    const input = new TextEncoder().encode(text);
    const out = inflateSync(await deflate(input));
    expect(out).toEqual(input);
  });

  it('round-trips through the fflate fallback when CompressionStream is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('CompressionStream', undefined);
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      const fallback = await import('../../src/codec/deflate');
      const input = new TextEncoder().encode('rat-Type : eutra\n'.repeat(50));
      const out = await fallback.inflate(await fallback.deflate(input));
      expect(out).toEqual(input);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
