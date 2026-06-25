/**
 * Full-parity gate for NR carrier-aggregation combos (Task 5).
 *
 * Tests: expectCapsFields(normalizeVolatile(caps), normalizeVolatile(nsgNr oracle), ['nrBands','nrca'])
 *
 * This covers:
 *   - nrca: all 5 NR-CA combos with feature-set-derived per-component fields
 *     (mimoDl/Ul, modulationDl/Ul, maxScs, maxBwDl/Ul, bw90mhzSupported, bwClassDl/Ul, bcs)
 *   - nrBands: full MIMO enrichment from feature sets (mimoDl/mimoUl for bands 41 and 71)
 *     plus the 90 MHz bandwidth entry added by updateNrBandsCapabilities for band 41 scs=30.
 */
import { describe, it } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';
import { expectCapsFields } from '../caps-harness';

const caps = interpret(nsgTextToCanonical(readFixtureText('nsgNr.input.txt')));
const oracle = readFixtureJson('nsgNr.caps.json');

describe('NR-CA + nrBands: nsgNr full NR parity', () => {
  it('nrca + nrBands deep-equal the nsgNr oracle', () => {
    expectCapsFields(
      normalizeVolatile(caps),
      normalizeVolatile(oracle),
      ['nrBands', 'nrca'],
    );
  });
});
