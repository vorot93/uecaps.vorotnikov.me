/**
 * Parity gate for NR bands (getNrBands) and NR-NSA bands (getNrNsaBandsEutra).
 *
 * nrNsaBandsEutra: full deep-equal against nsgMrdc oracle.
 *
 * nrBands: field-subset gate. Two Task-5-derived enrichments are excluded here:
 *   1. mimoDl/mimoUl — set by linkFeaturesAndCarrier (Task 5).
 *   2. 90 MHz bandwidth entry — added by updateNrBandsCapabilities (Task 5)
 *      when channelBW-90mhz is set in a feature-set PerCC entry (only affects
 *      band 41 scs=30 in nsgNr).
 *
 * Everything else (band, modulationDl/Ul, powerClass, rateMatchingLteCrs,
 * bandwidths minus the 90 MHz entry for band 41) is gated here.
 */
import { describe, it } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';
import { expectCapsFields } from '../caps-harness';
import type { BandNrDetails, BwsNr } from '../../../src/parser/types/uecapabilityparser';

// --- nsgMrdc: test nrNsaBandsEutra ---
const mrdcCaps = interpret(nsgTextToCanonical(readFixtureText('nsgMrdc.input.txt')));
const mrdcOracle = readFixtureJson('nsgMrdc.caps.json');

// --- nsgNr: test nrBands ---
const nrCaps = interpret(nsgTextToCanonical(readFixtureText('nsgNr.input.txt')));
const nrOracle = readFixtureJson('nsgNr.caps.json') as Record<string, unknown>;

/**
 * Remove Task-5-derived fields from a band list so Task 3 can gate independently.
 *
 * Strips:
 *   - mimoDl / mimoUl (feature-set-derived, Task 5)
 *   - maxUplinkDutyCycle (not in this fixture's oracle)
 *   - 90 MHz entries from bandwidths (added by updateNrBandsCapabilities in Task 5
 *     when channelBW-90mhz is present in the feature set)
 */
function stripTask5Fields(bands: BandNrDetails[]): unknown[] {
  return bands.map((b) => {
    const { mimoDl: _dl, mimoUl: _ul, maxUplinkDutyCycle: _dc, ...rest } = b;

    // Strip 90 MHz from bandwidths (Task 5 adds it via channelBW-90mhz in feature sets)
    if (rest.bandwidths) {
      rest.bandwidths = (rest.bandwidths as BwsNr[]).map((bwsNr: BwsNr) => ({
        scs: bwsNr.scs,
        bandwidthsDl: (bwsNr.bandwidthsDl ?? []).filter((bw: number) => bw !== 90),
        bandwidthsUl: (bwsNr.bandwidthsUl ?? []).filter((bw: number) => bw !== 90),
      })) as BwsNr[];
    }

    return rest;
  });
}

describe('NR-NSA bands: nsgMrdc', () => {
  it('nrNsaBandsEutra deep-equals the nsgMrdc oracle', () => {
    expectCapsFields(
      normalizeVolatile(mrdcCaps),
      normalizeVolatile(mrdcOracle),
      ['nrNsaBandsEutra'],
    );
  });
});

describe('NR bands: nsgNr', () => {
  it('nrBands band-set matches oracle (correct count and band numbers)', () => {
    const oracleBands = (nrOracle['nrBands'] ?? []) as BandNrDetails[];
    const actualBandNumbers = (nrCaps.nrBands ?? []).map((b) => b.band).sort((a, b) => a - b);
    const oracleBandNumbers = oracleBands.map((b) => b.band).sort((a, b) => a - b);
    expectCapsFields(
      { bands: actualBandNumbers },
      { bands: oracleBandNumbers },
      ['bands'],
    );
  });

  it('nrBands: band, bandwidths, modulationDl/Ul, powerClass, rateMatchingLteCrs match oracle (Task-5 fields excluded)', () => {
    const oracleBands = (nrOracle['nrBands'] ?? []) as BandNrDetails[];
    const actual = stripTask5Fields(nrCaps.nrBands ?? []);
    const expected = stripTask5Fields(oracleBands);
    expectCapsFields(
      normalizeVolatile({ nrBands: actual }),
      normalizeVolatile({ nrBands: expected }),
      ['nrBands'],
    );
  });
});
