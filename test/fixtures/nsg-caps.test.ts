import { describe, it, expect } from 'vitest';
import { readFixtureJson } from '../parser/harness';

describe('NR Stage-2 oracles present', () => {
  it('nsgNr has nrBands + nrca', () => {
    const o = readFixtureJson('nsgNr.caps.json') as Record<string, unknown>;
    expect(Array.isArray(o.nrBands)).toBe(true);
    expect(Array.isArray(o.nrca)).toBe(true);
  });
  it('nsgMrdc has endc + nrNsaBandsEutra', () => {
    const o = readFixtureJson('nsgMrdc.caps.json') as Record<string, unknown>;
    expect(Array.isArray(o.endc)).toBe(true);
    expect(Array.isArray(o.nrNsaBandsEutra)).toBe(true);
  });
});
