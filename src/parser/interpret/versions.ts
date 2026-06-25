/**
 * Shared version-navigation helpers for LTE (and future NR) capability parsing.
 *
 * `nceChain` is the variadic walker extracted from lte-bands.ts and lte-ca.ts:
 *   - a number segment: descend that many `nonCriticalExtension` levels
 *   - a string segment: descend into that named key
 *   - returns undefined on missing path (never throws)
 */

import { getObject } from '../json';

/**
 * Walk a chain of segments through a `nonCriticalExtension` tree.
 *
 * Each segment is either:
 *   - `number n`: descend `nonCriticalExtension` n times
 *   - `string key`: descend into `key`
 *
 * Returns `undefined` if any step is missing; never throws.
 */
export function nceChain(
  root: Record<string, unknown>,
  ...segments: Array<string | number>
): Record<string, unknown> | undefined {
  let cur: Record<string, unknown> | undefined = root;
  for (const seg of segments) {
    if (!cur) return undefined;
    if (typeof seg === 'number') {
      // repeat "nonCriticalExtension" n times
      for (let i = 0; i < seg; i++) {
        cur = getObject(cur, 'nonCriticalExtension');
        if (!cur) return undefined;
      }
    } else {
      cur = getObject(cur, seg);
    }
  }
  return cur;
}
