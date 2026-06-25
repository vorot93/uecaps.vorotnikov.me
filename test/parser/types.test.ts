import { describe, it, expect } from 'vitest';
import type { Capabilities } from '../../src/parser/types/uecapabilityparser';

describe('vendored types', () => {
  it('expose the Capabilities contract', () => {
    const cap: Pick<Capabilities, 'parserVersion' | 'metadata'> = {
      parserVersion: 'test',
      metadata: {},
    };
    expect(cap.parserVersion).toBe('test');
  });
});
