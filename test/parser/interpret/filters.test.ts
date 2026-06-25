import { describe, it, expect } from 'vitest';
import { nrCapabilityFilter, lteCapabilityFilter } from '../../../src/parser/interpret/filters';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { getObject } from '../../../src/parser/json';
import { readFixtureText, readFixtureJson } from '../harness';
import type { Rat } from '../../../src/parser/types/uecapabilityparser';

function rat(input: string, key: string): Record<string, unknown> {
  const c = getObject(nsgTextToCanonical(readFixtureText(input)), key);
  expect(c).toBeDefined();
  return c!;
}

describe('nrCapabilityFilter', () => {
  it('NR filter deep-equals the nsgNr oracle ueCapFilters[0]', () => {
    const oracle = readFixtureJson('nsgNr.caps.json') as { ueCapFilters: unknown[] };
    expect(nrCapabilityFilter(rat('nsgNr.input.txt', 'nr'), 'NR' as Rat)).toEqual(oracle.ueCapFilters[0]);
  });
  it('EUTRA_NR filter deep-equals the nsgMrdc oracle EUTRA_NR entry', () => {
    const oracle = readFixtureJson('nsgMrdc.caps.json') as { ueCapFilters: Array<{ rat: string }> };
    const want = oracle.ueCapFilters.find((f) => f.rat === 'EUTRA_NR');
    expect(want).toBeDefined();
    expect(nrCapabilityFilter(rat('nsgMrdc.input.txt', 'eutra-nr'), 'EUTRA_NR' as Rat)).toEqual(want);
  });
});

describe('lteCapabilityFilter', () => {
  it('LTE filter deep-equals the nsgEutra oracle ueCapFilters[0]', () => {
    const oracle = readFixtureJson('nsgEutra.caps.json') as { ueCapFilters: unknown[] };
    expect(lteCapabilityFilter(rat('nsgEutra.input.txt', 'eutra'))).toEqual(oracle.ueCapFilters[0]);
  });
  it('LTE filter deep-equals the nsgMrdc oracle EUTRA entry', () => {
    const oracle = readFixtureJson('nsgMrdc.caps.json') as { ueCapFilters: Array<{ rat: string }> };
    const want = oracle.ueCapFilters.find((f) => f.rat === 'EUTRA');
    expect(want).toBeDefined();
    expect(lteCapabilityFilter(rat('nsgMrdc.input.txt', 'eutra'))).toEqual(want);
  });
});
