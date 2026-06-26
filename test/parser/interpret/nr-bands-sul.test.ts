import { describe, it, expect } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';
import { expectCapsFields } from '../caps-harness';
import type { Capabilities, BandNrDetails } from '../../../src/parser/types/uecapabilityparser';

const caps = interpret(nsgTextToCanonical(readFixtureText('nsgSul.input.txt'))) as Capabilities;
const oracle = readFixtureJson('nsgSul.caps.json');

describe('SUL: nsgSul parity', () => {
  it('SUL bands 80 and 84 have no DL modulation/MIMO and empty DL bandwidths', () => {
    for (const num of [80, 84]) {
      const band = (caps.nrBands ?? []).find((b: BandNrDetails) => b.band === num);
      expect(band, `nrBands must contain band ${num}`).toBeDefined();
      expect(band!.modulationDl, `band ${num} modulationDl`).toBeUndefined();
      expect(band!.mimoDl, `band ${num} mimoDl`).toBeUndefined();
      for (const bw of band!.bandwidths ?? []) {
        expect(bw.bandwidthsDl, `band ${num} bandwidthsDl`).toEqual([]);
      }
    }
  });

  it('caps deep-equal the nsgSul oracle (populated fields)', () => {
    expectCapsFields(normalizeVolatile(caps), normalizeVolatile(oracle), [
      'nrBands',
      'nrca',
      'lteca',
      'lteBands',
      'lteCategoryDl',
      'lteCategoryUl',
      'nrNsaBandsEutra',
      'ueCapFilters',
      'ratCapabilities',
    ]);
  });
});
