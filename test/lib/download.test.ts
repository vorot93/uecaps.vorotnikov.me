import { describe, it, expect, vi } from 'vitest';
import { downloadCsv } from '../../src/lib/download';

describe('downloadCsv', () => {
  it('builds a text/csv Blob, names the download, clicks, and revokes', () => {
    const seen: { type?: string } = {};
    const createObjectURL = vi.fn((b: Blob) => {
      seen.type = b.type;
      return 'blob:fake';
    });
    const revokeObjectURL = vi.fn();
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const createElement = vi.fn(() => anchor as unknown as HTMLAnchorElement);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', { createElement, body: { appendChild: vi.fn() } });

    downloadCsv('ue-capabilities.csv', 'a,b\n1,2\n');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(seen.type).toContain('text/csv');
    expect(anchor.download).toBe('ue-capabilities.csv');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');

    vi.unstubAllGlobals();
  });
});
