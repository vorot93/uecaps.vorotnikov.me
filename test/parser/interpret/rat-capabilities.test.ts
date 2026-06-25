import { describe, it, expect } from 'vitest';
import { ratCapabilitiesLte, ratCapabilitiesNr, accessRelease } from '../../../src/parser/interpret/rat-capabilities';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { getObject } from '../../../src/parser/json';
import { readFixtureText, readFixtureJson } from '../harness';

function rat(input: string, key: string): Record<string, unknown> {
  const c = getObject(nsgTextToCanonical(readFixtureText(input)), key);
  expect(c).toBeDefined();
  return c!;
}

describe('rat-capabilities builders', () => {
  it('accessRelease maps relNN -> NN and null when absent', () => {
    expect(accessRelease(rat('nsgEutra.input.txt', 'eutra'))).toBe(11);
    expect(accessRelease(rat('nsgNr.input.txt', 'nr'))).toBe(15);
    expect(accessRelease({})).toBe(null);
  });
  it('ratCapabilitiesLte(eutra) deep-equals the nsgEutra oracle entry', () => {
    const oracle = readFixtureJson('nsgEutra.caps.json') as { ratCapabilities: unknown[] };
    expect(oracle.ratCapabilities[0]).toBeDefined();
    expect(ratCapabilitiesLte(rat('nsgEutra.input.txt', 'eutra'))).toEqual(oracle.ratCapabilities[0]);
  });
  it('ratCapabilitiesNr(nr) deep-equals the nsgNr oracle entry', () => {
    const oracle = readFixtureJson('nsgNr.caps.json') as { ratCapabilities: unknown[] };
    expect(oracle.ratCapabilities[0]).toBeDefined();
    expect(ratCapabilitiesNr(rat('nsgNr.input.txt', 'nr'))).toEqual(oracle.ratCapabilities[0]);
  });
});
