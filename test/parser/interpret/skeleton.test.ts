import { describe, it, expect } from 'vitest';
import { interpret } from '../../../src/parser/interpret';

describe('interpret skeleton', () => {
  it('returns a Capabilities for empty canonical', () => {
    const caps = interpret({});
    expect(Array.isArray(caps.lteBands)).toBe(true);
    expect(Array.isArray(caps.lteca)).toBe(true);
    expect(caps.lteBands).toEqual([]);
    expect(caps.lteca).toEqual([]);
  });
});
