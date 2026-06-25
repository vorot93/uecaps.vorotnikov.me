/**
 * Unit tests for the shared version-navigation helper in src/parser/interpret/versions.ts.
 *
 * Tests pin the nceChain behavior:
 *   - number segment: descend that many `nonCriticalExtension` levels
 *   - string segment: descend into that named key
 *   - returns undefined on missing path (never throws)
 */

import { describe, it, expect } from 'vitest';
import { nceChain } from '../../../src/parser/interpret/versions';

describe('nceChain', () => {
  it('descends N nonCriticalExtension levels', () => {
    const obj = {
      nonCriticalExtension: {
        nonCriticalExtension: { x: { y: 1 } },
      },
    };
    expect(nceChain(obj, 2)).toEqual({ x: { y: 1 } });
  });

  it('combines NCE descent with named-key descent', () => {
    const obj = {
      nonCriticalExtension: {
        nonCriticalExtension: { x: { y: 1 } },
      },
    };
    expect(nceChain(obj, 2, 'x')).toEqual({ y: 1 });
  });

  it('handles mixed steps: number then string then number', () => {
    const obj = {
      nonCriticalExtension: {
        section: {
          nonCriticalExtension: { leaf: 42 },
        },
      },
    };
    expect(nceChain(obj, 1, 'section', 1)).toEqual({ leaf: 42 });
  });

  it('returns undefined when NCE chain is too short', () => {
    const obj = { nonCriticalExtension: { a: 1 } };
    // asking for 2 NCE levels but only 1 available
    expect(nceChain(obj, 2)).toBeUndefined();
  });

  it('returns undefined when a named key is missing', () => {
    const obj = { nonCriticalExtension: { x: { y: 1 } } };
    expect(nceChain(obj, 1, 'missing')).toBeUndefined();
  });

  it('returns root when called with no segments', () => {
    const obj = { a: 1 };
    expect(nceChain(obj)).toEqual({ a: 1 });
  });

  it('returns undefined and does not throw when segment follows undefined', () => {
    // n=1 requires nonCriticalExtension, then named key — but nce is missing
    const obj = { other: { x: 1 } };
    expect(() => nceChain(obj, 1, 'x')).not.toThrow();
    expect(nceChain(obj, 1, 'x')).toBeUndefined();
  });

  it('handles 0 as NCE count (no descent)', () => {
    const obj = { a: 1 };
    expect(nceChain(obj, 0)).toEqual({ a: 1 });
  });

  it('returns the object at a single named key', () => {
    const obj = { section: { val: 99 } };
    expect(nceChain(obj, 'section')).toEqual({ val: 99 });
  });
});
