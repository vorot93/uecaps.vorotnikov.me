/**
 * Focused unit tests for NR feature-set parsing.
 *
 * These tests pin the intermediate structures that Tasks 5 and 6 will consume
 * (NR-CA and EN-DC combo resolution). They assert concrete facts computed
 * from the real canonical input (nsgNr.input.txt / nsgMrdc.input.txt) against
 * the expected values derived from the raw ueLog JSON fixtures.
 *
 * There is no direct oracle field for feature sets; the downstream oracle gate
 * is Task 5's nrca field (nsgNr full parity). These tests independently pin
 * the structure before Task 5 consumes it.
 */
import { describe, it, expect } from 'vitest';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText } from '../harness';
import { getNrFeatureSet, getLteFeatureSet, getFeatureSetCombinations } from '../../../src/parser/interpret/nr-features';

// ---------------------------------------------------------------------------
// Fixtures — parse once at module level
// ---------------------------------------------------------------------------

const nrCanonical = nsgTextToCanonical(readFixtureText('nsgNr.input.txt'));
const mrdcCanonical = nsgTextToCanonical(readFixtureText('nsgMrdc.input.txt'));

function getNrContainer(canonical: Record<string, unknown>): Record<string, unknown> {
  const nr = canonical['nr'];
  if (!nr || typeof nr !== 'object' || Array.isArray(nr)) throw new Error('no nr container');
  return nr as Record<string, unknown>;
}

function getEutraContainer(canonical: Record<string, unknown>): Record<string, unknown> {
  const eutra = canonical['eutra'];
  if (!eutra || typeof eutra !== 'object' || Array.isArray(eutra)) throw new Error('no eutra container');
  return eutra as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// getNrFeatureSet tests (using nsgNr fixture)
// ---------------------------------------------------------------------------

describe('getNrFeatureSet — nsgNr', () => {
  const nr = getNrContainer(nrCanonical);
  const fs = getNrFeatureSet(nr);

  it('returns 3 downlink feature sets and 2 uplink feature sets', () => {
    // nsgNr.ueLog.json: featureSetsDownlink has 3 entries, featureSetsUplink has 2 entries
    expect(fs.downlink).toHaveLength(3);
    expect(fs.uplink).toHaveLength(2);
  });

  it('DL FeatureSet[0] has 1 PerCC entry with scs=30, bw=100, channelBW90mhz=true, mimo=4', () => {
    const dlFs0 = fs.downlink[0];
    expect(dlFs0).toBeDefined();
    const perCC = dlFs0!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    const cc0 = perCC[0]!;
    expect(cc0.scs).toBe(30);
    expect(cc0.bw).toBe(100);
    expect(cc0.channelBW90mhz).toBe(true);
    // mimo: fromLiteral('fourLayers')=4, max(4,2)=4 → single(4)
    expect(cc0.mimo).toEqual({ type: 'single', value: 4 });
  });

  it('DL FeatureSet[1] has 1 PerCC entry with scs=15, bw=20, channelBW90mhz=false, mimo=2', () => {
    const dlFs1 = fs.downlink[1];
    expect(dlFs1).toBeDefined();
    const perCC = dlFs1!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    const cc0 = perCC[0]!;
    expect(cc0.scs).toBe(15);
    expect(cc0.bw).toBe(20);
    expect(cc0.channelBW90mhz).toBe(false);
    // mimo: fromLiteral('twoLayers')=2, max(2,2)=2 → single(2)
    expect(cc0.mimo).toEqual({ type: 'single', value: 2 });
  });

  it('DL FeatureSet[2] has 2 PerCC entries (featureSetListPerDownlinkCC=[1,1])', () => {
    const dlFs2 = fs.downlink[2];
    expect(dlFs2).toBeDefined();
    const perCC = dlFs2!.featureSetsPerCC;
    expect(perCC).toHaveLength(2);
    // Both entries refer to PerCC index 0 (1-1=0) → scs=30, bw=100, mimo=4
    expect(perCC[0]!.scs).toBe(30);
    expect(perCC[0]!.mimo).toEqual({ type: 'single', value: 4 });
    expect(perCC[1]!.scs).toBe(30);
    expect(perCC[1]!.mimo).toEqual({ type: 'single', value: 4 });
  });

  it('UL FeatureSet[0] has 1 PerCC entry with scs=15, bw=20, channelBW90mhz=false, mimo=1', () => {
    const ulFs0 = fs.uplink[0];
    expect(ulFs0).toBeDefined();
    const perCC = ulFs0!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    const cc0 = perCC[0]!;
    expect(cc0.scs).toBe(15);
    expect(cc0.bw).toBe(20);
    expect(cc0.channelBW90mhz).toBe(false);
    // mimo-CB-PUSCH.maxNumberMIMO-LayersCB-PUSCH='oneLayer' → fromLiteral=1, max(1,1)=1
    expect(cc0.mimo).toEqual({ type: 'single', value: 1 });
  });

  it('UL FeatureSet[1] has 1 PerCC entry with scs=30, bw=100, channelBW90mhz=true, mimo=2', () => {
    const ulFs1 = fs.uplink[1];
    expect(ulFs1).toBeDefined();
    const perCC = ulFs1!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    const cc0 = perCC[0]!;
    expect(cc0.scs).toBe(30);
    expect(cc0.bw).toBe(100);
    expect(cc0.channelBW90mhz).toBe(true);
    // mimo-CB-PUSCH.maxNumberMIMO-LayersCB-PUSCH='twoLayers' → fromLiteral=2, max(2,1)=2
    expect(cc0.mimo).toEqual({ type: 'single', value: 2 });
  });
});

// ---------------------------------------------------------------------------
// getLteFeatureSet tests (using nsgMrdc fixture)
// ---------------------------------------------------------------------------

describe('getLteFeatureSet — nsgMrdc', () => {
  const eutra = getEutraContainer(mrdcCanonical);
  const fs = getLteFeatureSet(eutra);

  it('returns 2 downlink feature sets and 1 uplink feature set', () => {
    // nsgMrdc eutra: featureSetsDL-r15 has 2 entries, featureSetsUL-r15 has 1 entry
    expect(fs.downlink).toHaveLength(2);
    expect(fs.uplink).toHaveLength(1);
  });

  it('LTE DL FeatureSet[0] has 1 PerCC entry with mimo=4', () => {
    const dlFs0 = fs.downlink[0];
    expect(dlFs0).toBeDefined();
    const perCC = dlFs0!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    // featureSetsDL-PerCC-r15[0]: supportedMIMO-CapabilityDL-MRDC-r15='fourLayers' → max(4,2)=4
    expect(perCC[0]!.mimo).toEqual({ type: 'single', value: 4 });
  });

  it('LTE DL FeatureSet[1] has 1 PerCC entry with mimo=2', () => {
    const dlFs1 = fs.downlink[1];
    expect(dlFs1).toBeDefined();
    const perCC = dlFs1!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    // featureSetsDL-PerCC-r15[1]: supportedMIMO-CapabilityDL-MRDC-r15='twoLayers' → max(2,2)=2
    expect(perCC[0]!.mimo).toEqual({ type: 'single', value: 2 });
  });

  it('LTE UL FeatureSet[0] has 1 PerCC entry with mimo=1 (empty perCC-r15 → default min 1)', () => {
    const ulFs0 = fs.uplink[0];
    expect(ulFs0).toBeDefined();
    const perCC = ulFs0!.featureSetsPerCC;
    expect(perCC).toHaveLength(1);
    // featureSetsUL-PerCC-r15[0]: {} → mimo=max(0,1)=1
    expect(perCC[0]!.mimo).toEqual({ type: 'single', value: 1 });
  });
});

// ---------------------------------------------------------------------------
// getFeatureSetCombinations tests (using nsgNr — NR-SA combos)
// ---------------------------------------------------------------------------

describe('getFeatureSetCombinations — nsgNr NR container', () => {
  const nr = getNrContainer(nrCanonical);
  const combos = getFeatureSetCombinations(nr);

  it('returns 5 feature-set combinations', () => {
    // nsgNr.ueLog.json: nr.featureSetCombinations has 5 entries
    expect(combos).toHaveLength(5);
  });

  it('combo[0] has 2 band positions, each with 1 feature index (isNR=true)', () => {
    // featureSetCombinations[0]: [[{nr:{dl:1,ul:0}}], [{nr:{dl:2,ul:1}}]]
    const combo0 = combos[0];
    expect(combo0).toHaveLength(2);
    expect(combo0![0]).toHaveLength(1);
    expect(combo0![1]).toHaveLength(1);
    // Band position 0: isNR=true, dlIndex=1, ulIndex=0
    const fi00 = combo0![0]![0]!;
    expect(fi00.isNR).toBe(true);
    expect(fi00.downlinkIndex).toBe(1);
    expect(fi00.uplinkIndex).toBe(0);
    // Band position 1: isNR=true, dlIndex=2, ulIndex=1
    const fi01 = combo0![1]![0]!;
    expect(fi01.isNR).toBe(true);
    expect(fi01.downlinkIndex).toBe(2);
    expect(fi01.uplinkIndex).toBe(1);
  });

  it('combo[2] has 1 band position (single band combo)', () => {
    // featureSetCombinations[2]: [[{nr:{dl:2,ul:1}}]]
    const combo2 = combos[2];
    expect(combo2).toHaveLength(1);
    const fi20 = combo2![0]![0]!;
    expect(fi20.isNR).toBe(true);
    expect(fi20.downlinkIndex).toBe(2);
    expect(fi20.uplinkIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getFeatureSetCombinations tests (using nsgMrdc — mixed NR + LTE indices)
// ---------------------------------------------------------------------------

describe('getFeatureSetCombinations — nsgMrdc eutra-nr container', () => {
  const eutraNr = mrdcCanonical['eutra-nr'];
  if (!eutraNr || typeof eutraNr !== 'object' || Array.isArray(eutraNr)) {
    throw new Error('no eutra-nr container');
  }
  const combos = getFeatureSetCombinations(eutraNr as Record<string, unknown>);

  it('returns 25 feature-set combinations', () => {
    // nsgMrdc.ueLog.json: eutra-nr.featureSetCombinations has 25 entries
    expect(combos).toHaveLength(25);
  });

  it('combo[0] has 3 band positions with eutra+eutra+nr mix', () => {
    // featureSetCombinations[0]: [[{eutra:{dl:1,ul:1}}],[{eutra:{dl:1,ul:0}}],[{nr:{dl:1,ul:1}}]]
    const combo0 = combos[0];
    expect(combo0).toHaveLength(3);
    // Position 0: eutra
    const fi00 = combo0![0]![0]!;
    expect(fi00.isNR).toBe(false);
    expect(fi00.downlinkIndex).toBe(1);
    expect(fi00.uplinkIndex).toBe(1);
    // Position 1: eutra
    const fi01 = combo0![1]![0]!;
    expect(fi01.isNR).toBe(false);
    expect(fi01.downlinkIndex).toBe(1);
    expect(fi01.uplinkIndex).toBe(0);
    // Position 2: NR
    const fi02 = combo0![2]![0]!;
    expect(fi02.isNR).toBe(true);
    expect(fi02.downlinkIndex).toBe(1);
    expect(fi02.uplinkIndex).toBe(1);
  });
});
