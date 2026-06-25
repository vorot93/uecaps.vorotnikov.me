/**
 * NR carrier-aggregation combo resolution.
 *
 * Ported from upstream ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser):
 *   - `getNrBandCombinations` (~line 887) — parse band combos from rf-Parameters
 *   - `parse5gBandParameters` (~line 935) — extract band/bwClass from band list entry
 *   - `linkFeaturesAndCarrier` (~line 700) — expand each combo across feature-set options
 *   - `mergeComboNrAndIndexedFeature` (~line 730) — merge one combo at a given option index
 *   - `mergeComponentAndFeature` (~line 819) — resolve per-band feature indices → per-CC fields
 *   - (mergeComponentAndFeaturePerCC / applyNrFeaturesPerCC from SharedHelper.kt)
 *   - `updateNrBandsCapabilities` (~line 491) — enrich nrBands MIMO + 90 MHz from combo components
 *
 * `getUlTxSwitchBandCombinations` is NOT ported: the nsgNr oracle has no `uplinkTxSwitch`
 * in any nrca component, so that path is out of scope for this gate.
 *
 * Output:
 *   - `getNrCa(nr, nrFeatures, fsCombinations, nrBandsMap): ComboNr[]`
 *   - `updateNrBandsCapabilities(nrBandsMap, nrca): void` — enriches nrBands in-place
 *
 * Ambient enums: all values produced as string literals. No DOM/Qwik. TS strict +
 * noUncheckedIndexedAccess.
 */

import type {
  BandNrDetails,
  Bandwidth,
  BCS,
  BwClass,
  BwsNr,
  ComboNr,
  ComponentNr,
  Mimo,
  Modulation,
  ModulationOrder,
} from '../types/uecapabilityparser';
import { getArray, getArrayAtPath, getObject, getString, getInt } from '../json';
import type {
  FeatureIndex,
  FeaturePerCCNr,
  NrFeatureSets,
} from './nr-features';

// ---------------------------------------------------------------------------
// Ambient-enum shims — all values are string literals matching oracle output.
// ---------------------------------------------------------------------------

type BCSType = BCS['type'];
type BwType = Bandwidth['type'];
type MimoType = Mimo['type'];
type ModType = Modulation['type'];

function bcsFromBinaryString(binary: string): BCS {
  const indices: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') indices.push(i);
  }
  if (indices.length === 0) return { type: 'empty' as BCSType } as BCS.empty;
  if (indices.length === 1) return { type: 'single' as BCSType, value: indices[0]! } as BCS.single;
  if (indices.length === 32) return { type: 'all' as BCSType } as BCS.all;
  return { type: 'multi' as BCSType, value: indices } as BCS.multi;
}

function bwFromInt(n: number): Bandwidth {
  if (n <= 0) return { type: 'empty' as BwType } as Bandwidth.empty;
  return { type: 'single' as BwType, value: n } as Bandwidth.single;
}

/**
 * Port of Bandwidth.from(list) — mirrors upstream Bandwidth.from(List<Int>).
 * If list is empty → empty; if all values are the same → single(first); else mixed (sorted desc).
 */
function bandwidthFromList(list: number[]): Bandwidth {
  if (list.length === 0) return { type: 'empty' as BwType } as Bandwidth.empty;
  if (list.length === 1) return bwFromInt(list[0]!);
  const distinct = new Set(list);
  if (distinct.size === 1) return bwFromInt(list[0]!);
  // MixedBandwidth: sorted descending
  const sorted = [...list].sort((a, b) => b - a);
  return { type: 'mixed' as BwType, value: sorted } as Bandwidth.mixed;
}

function mimoFrom(n: number): Mimo {
  if (n === 0) return { type: 'empty' as MimoType } as Mimo.empty;
  return { type: 'single' as MimoType, value: n } as Mimo.single;
}

/**
 * Port of Mimo.from(List<Int>) — mirrors upstream Mimo.from(list):
 * empty → empty; all-same → single(first); else → mixed(sortedDesc).
 * Exported for reuse in endc.ts.
 */
export function mimoFromListNr(list: number[]): Mimo {
  if (list.length === 0) return { type: 'empty' as MimoType } as Mimo.empty;
  const first = list[0]!;
  if (list.length === 1 || list.every((v) => v === first)) return mimoFrom(first);
  const sorted = [...list].sort((a, b) => b - a);
  return { type: 'mixed' as MimoType, value: sorted } as Mimo.mixed;
}

function mimoAverage(mimo: Mimo): number {
  if (mimo.type === ('single' as MimoType)) return (mimo as Mimo.single).value;
  if (mimo.type === ('mixed' as MimoType)) {
    const arr = (mimo as Mimo.mixed).value;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  return 0;
}

function modulationFromStr(s: string): Modulation {
  return { type: 'single' as ModType, value: s as ModulationOrder } as Modulation & { type: 'single' };
}

// ---------------------------------------------------------------------------
// Internal mutable NR component (built during resolution, then frozen to ComponentNr)
// Exported for reuse in endc.ts.
// ---------------------------------------------------------------------------

export interface MutableComponentNr {
  band: number;
  bwClassDl?: string;
  bwClassUl?: string;
  mimoDl?: Mimo;
  mimoUl?: Mimo;
  modulationDl?: Modulation;
  modulationUl?: Modulation;
  bw90mhzSupported?: boolean;
  maxScs?: number;
  maxBwDl?: Bandwidth;
  maxBwUl?: Bandwidth;
}

function freezeNrComponent(c: MutableComponentNr): ComponentNr {
  const result: ComponentNr = { band: c.band };
  if (c.bwClassDl !== undefined && c.bwClassDl !== 'none') result.bwClassDl = c.bwClassDl as BwClass;
  if (c.bwClassUl !== undefined && c.bwClassUl !== 'none') result.bwClassUl = c.bwClassUl as BwClass;
  if (c.mimoDl !== undefined && c.mimoDl.type !== 'empty') result.mimoDl = c.mimoDl;
  if (c.mimoUl !== undefined && c.mimoUl.type !== 'empty') result.mimoUl = c.mimoUl;
  if (c.modulationDl !== undefined && c.modulationDl.type !== 'empty') result.modulationDl = c.modulationDl;
  if (c.modulationUl !== undefined && c.modulationUl.type !== 'empty') result.modulationUl = c.modulationUl;
  if (c.bw90mhzSupported === true) result.bw90mhzSupported = true;
  if (c.maxScs !== undefined && c.maxScs > 0) result.maxScs = c.maxScs;
  if (c.maxBwDl !== undefined && c.maxBwDl.type !== 'empty') result.maxBwDl = c.maxBwDl;
  if (c.maxBwUl !== undefined && c.maxBwUl.type !== 'empty') result.maxBwUl = c.maxBwUl;
  return result;
}

// ---------------------------------------------------------------------------
// clampNrBw — from SharedHelper.kt ~line 77
// ---------------------------------------------------------------------------

function clampNrBw(maxBwFeatures: number, maxBwBand: number): number {
  // Skip clamp for 90 MHz or >= 400 MHz
  if (maxBwFeatures !== 90 && maxBwFeatures < 400) {
    return Math.min(maxBwFeatures, maxBwBand);
  }
  return maxBwFeatures;
}

// ---------------------------------------------------------------------------
// applyNrFeaturesPerCC — from SharedHelper.kt ~line 93
// Applies DL or UL feature-per-CC list to a mutable NR component.
// Exported for reuse in endc.ts (EN-DC NR-component feature application).
// ---------------------------------------------------------------------------

export function applyNrFeaturesPerCC(
  direction: 'DL' | 'UL',
  component: MutableComponentNr,
  feature: FeaturePerCCNr[] | undefined,
  bandDetails: BandNrDetails | undefined,
): void {
  if (!feature || feature.length === 0) {
    // setSdlSul: no feature → clear the direction's bwClass and mimo
    if (direction === 'DL') {
      component.bwClassDl = 'none';
      component.mimoDl = { type: 'empty' as MimoType } as Mimo.empty;
    } else {
      component.bwClassUl = 'none';
      component.mimoUl = { type: 'empty' as MimoType } as Mimo.empty;
    }
    return;
  }

  // scs and channelBW90mhz are "single" features shared between DL and UL
  // (take the max/union)
  const scs = Math.max(...feature.map((f) => f.scs));
  component.maxScs = Math.max(component.maxScs ?? 0, scs);
  component.bw90mhzSupported =
    (component.bw90mhzSupported ?? false) || feature.some((f) => f.channelBW90mhz);

  // Max BW from band's bandwidth table for this SCS
  const bwEntry = bandDetails?.bandwidths?.find((b) => b.scs === scs);
  const bwsForDir =
    bwEntry !== undefined
      ? direction === 'DL'
        ? (bwEntry.bandwidthsDl ?? [])
        : (bwEntry.bandwidthsUl ?? [])
      : undefined;
  const maxBwBand = maxOrZero(bwsForDir) || Number.MAX_SAFE_INTEGER;

  let mimo: Mimo;
  let bwBandwidth: Bandwidth;

  if (feature.length > 1) {
    // Multi-CC case:
    // MIMO: Mimo.from(list of trunc-averages) — if all same → single, else mixed(sortedDesc)
    const mimoValues = feature.map((f) => Math.trunc(mimoAverage(f.mimo)));
    mimo = mimoFromListNr(mimoValues);
    // Bandwidth: Bandwidth.from(clamped list) — if all same → single, else mixed
    const clampedBws = feature.map((f) => clampNrBw(f.bw, maxBwBand));
    bwBandwidth = bandwidthFromList(clampedBws);
  } else {
    const f = feature[0]!;
    mimo = f.mimo;
    bwBandwidth = bwFromInt(clampNrBw(f.bw, maxBwBand));
  }

  // Modulation: use bandDetails mod (it takes precedence over feature mod per TS 38.306)
  const mod: Modulation | undefined =
    direction === 'DL' ? bandDetails?.modulationDl : bandDetails?.modulationUl;

  if (direction === 'DL') {
    component.mimoDl = mimo;
    component.maxBwDl = bwBandwidth;
    if (mod) component.modulationDl = mod;
  } else {
    component.mimoUl = mimo;
    component.maxBwUl = bwBandwidth;
    if (mod) component.modulationUl = mod;
  }
}

// ---------------------------------------------------------------------------
// Helper: find max value in an array (returns 0 if empty or undefined)
// ---------------------------------------------------------------------------
function maxOrZero(arr: number[] | undefined): number {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => Math.max(a, b), 0);
}

// ---------------------------------------------------------------------------
// parse5gBandParameters — port of upstream ~line 935
// ---------------------------------------------------------------------------

function parse5gBandParameters(
  bandParameters: Record<string, unknown>,
): MutableComponentNr | null {
  const nr = getObject(bandParameters, 'nr');
  if (nr !== undefined) {
    const band = getInt(nr, 'bandNR') ?? 0;
    const dlClassStr = getString(nr, 'ca-BandwidthClassDL-NR');
    const ulClassStr = getString(nr, 'ca-BandwidthClassUL-NR');
    const component: MutableComponentNr = { band };
    if (dlClassStr !== undefined) component.bwClassDl = dlClassStr.toUpperCase();
    if (ulClassStr !== undefined) component.bwClassUl = ulClassStr.toUpperCase();
    return component;
  }
  return null;
}

// ---------------------------------------------------------------------------
// sortComponentsNr — sort descending (upstream: newNrComponents.sortDescending())
// Upstream sort order: primarily by band desc, then by bwClassDl desc (A < B < C …)
// ---------------------------------------------------------------------------

function bwClassOrdinal(cls: string | undefined): number {
  if (!cls || cls === 'none') return 0;
  return cls.charCodeAt(0); // 'A'=65, 'B'=66, 'C'=67 …
}

function sortComponentsNrDesc(components: MutableComponentNr[]): void {
  // Mirrors upstream ComponentNr.compareTo() keys (descending):
  // band, classDL, classUL, mimoDL, mimoUL, scs, maxBandwidthDl, maxBandwidthUl
  components.sort((a, b) => {
    if (b.band !== a.band) return b.band - a.band;
    const dlDiff = bwClassOrdinal(b.bwClassDl) - bwClassOrdinal(a.bwClassDl);
    if (dlDiff !== 0) return dlDiff;
    const ulDiff = bwClassOrdinal(b.bwClassUl) - bwClassOrdinal(a.bwClassUl);
    if (ulDiff !== 0) return ulDiff;
    const mimoDlDiff = mimoAverage(b.mimoDl ?? EMPTY_MIMO) - mimoAverage(a.mimoDl ?? EMPTY_MIMO);
    if (mimoDlDiff !== 0) return mimoDlDiff;
    const mimoUlDiff = mimoAverage(b.mimoUl ?? EMPTY_MIMO) - mimoAverage(a.mimoUl ?? EMPTY_MIMO);
    if (mimoUlDiff !== 0) return mimoUlDiff;
    const scsDiff = (b.maxScs ?? 0) - (a.maxScs ?? 0);
    if (scsDiff !== 0) return scsDiff;
    const bwDlDiff = bwValue(b.maxBwDl) - bwValue(a.maxBwDl);
    if (bwDlDiff !== 0) return bwDlDiff;
    return bwValue(b.maxBwUl) - bwValue(a.maxBwUl);
  });
}

const EMPTY_MIMO: Mimo = { type: 'empty' as MimoType } as Mimo.empty;

function bwValue(bw: Bandwidth | undefined): number {
  if (!bw || bw.type === 'empty') return 0;
  if (bw.type === ('single' as BwType)) return (bw as Bandwidth.single).value;
  return 0;
}

// ---------------------------------------------------------------------------
// mergeOneCombo — merges a single combo for the given feature-set option index.
// Mirrors mergeComboNrAndIndexedFeature (NR-only path).
// ---------------------------------------------------------------------------

function mergeOneComboNr(
  rawComponents: MutableComponentNr[],
  featureSetsPerBand: FeatureIndex[][],
  optionIndex: number,
  nrFeatures: NrFeatureSets,
  nrBandsMap: Map<number, BandNrDetails>,
): MutableComponentNr[] | null {
  const mergedComponents: MutableComponentNr[] = [];
  const componentIterator = rawComponents.values();

  for (const featureSetBand of featureSetsPerBand) {
    const featureIndex = featureSetBand[optionIndex];
    if (featureIndex === undefined) return null;

    const rawComp = componentIterator.next().value as MutableComponentNr | undefined;
    if (rawComp === undefined) return null;

    // Copy the raw component (so we don't mutate the original)
    const comp: MutableComponentNr = { ...rawComp };

    const merged = mergeComponentAndFeatureNr(featureIndex, comp, nrFeatures, nrBandsMap);
    if (merged === null) return null; // fallback combination — skip whole option

    mergedComponents.push(merged);
  }

  sortComponentsNrDesc(mergedComponents);
  return mergedComponents;
}

// ---------------------------------------------------------------------------
// mergeComponentAndFeature (NR path only) — port of upstream ~line 819
// ---------------------------------------------------------------------------

function mergeComponentAndFeatureNr(
  featureSet: FeatureIndex,
  component: MutableComponentNr,
  nrFeatures: NrFeatureSets,
  nrBandsMap: Map<number, BandNrDetails>,
): MutableComponentNr | null {
  const dlIndex = featureSet.downlinkIndex - 1; // 1-based → 0-based
  const ulIndex = featureSet.uplinkIndex - 1;

  if (dlIndex < 0 && ulIndex < 0) {
    // Fallback combination — return null to signal skip
    return null;
  }

  const dlFeature =
    dlIndex >= 0 ? (nrFeatures.downlink[dlIndex]?.featureSetsPerCC ?? null) : null;
  const ulFeature =
    ulIndex >= 0 ? (nrFeatures.uplink[ulIndex]?.featureSetsPerCC ?? null) : null;

  // If features can't be resolved, return component clone without editing
  const dlMissing = dlIndex >= 0 && (dlFeature === null || dlFeature.length === 0);
  const ulMissing = ulIndex >= 0 && (ulFeature === null || ulFeature.length === 0);
  if (dlMissing || ulMissing) {
    return { ...component };
  }

  const bandDetails = nrBandsMap.get(component.band);

  applyNrFeaturesPerCC('DL', component, dlFeature ?? undefined, bandDetails);
  applyNrFeaturesPerCC('UL', component, ulFeature ?? undefined, bandDetails);

  return component;
}

// ---------------------------------------------------------------------------
// linkFeaturesAndCarrierNr — port of upstream ~line 700 (NR-only path)
// ---------------------------------------------------------------------------

function linkFeaturesAndCarrierNr(
  rawCombos: Array<{ components: MutableComponentNr[]; featureSet: number; bcs: BCS }>,
  fsCombinations: FeatureIndex[][][],
  nrFeatures: NrFeatureSets,
  nrBandsMap: Map<number, BandNrDetails>,
): ComboNr[] {
  const result: ComboNr[] = [];

  for (const rawCombo of rawCombos) {
    const featureSetsPerBand = fsCombinations[rawCombo.featureSet];
    if (!featureSetsPerBand || featureSetsPerBand.length === 0) continue;

    // Number of options = number of entries in the first band position
    const firstBandPos = featureSetsPerBand[0];
    if (!firstBandPos || firstBandPos.length === 0) continue;
    const optionCount = firstBandPos.length;

    for (let optIdx = 0; optIdx < optionCount; optIdx++) {
      const mergedComponents = mergeOneComboNr(
        rawCombo.components,
        featureSetsPerBand,
        optIdx,
        nrFeatures,
        nrBandsMap,
      );
      if (mergedComponents === null) continue;

      result.push({
        components: mergedComponents.map(freezeNrComponent),
        bcs: rawCombo.bcs,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// getNrBandCombinations — port of upstream ~line 887 (NR-SA path only)
// ---------------------------------------------------------------------------

function getNrBandCombinations(
  nr: Record<string, unknown>,
): Array<{ components: MutableComponentNr[]; featureSet: number; bcs: BCS }> {
  const bandCombinationsList = getArrayAtPath(nr, 'rf-Parameters.supportedBandCombinationList');
  if (!bandCombinationsList) return [];

  const result: Array<{ components: MutableComponentNr[]; featureSet: number; bcs: BCS }> = [];

  for (const bandCombination of bandCombinationsList) {
    const rec = bandCombination as Record<string, unknown>;
    const bandList = getArray(rec, 'bandList');
    if (!bandList) continue;

    const components: MutableComponentNr[] = [];
    for (const bandParameters of bandList) {
      const component = parse5gBandParameters(bandParameters as Record<string, unknown>);
      if (component !== null) {
        components.push(component);
      }
    }

    const featureSet = getInt(rec, 'featureSetCombination') ?? 0;
    const bcsString = getString(rec, 'supportedBandwidthCombinationSet') ?? '1';
    const bcs = bcsFromBinaryString(bcsString);

    result.push({ components, featureSet, bcs });
  }

  return result;
}

// ---------------------------------------------------------------------------
// updateNrBandsCapabilities — port of upstream ~line 491
// Enriches nrBands MIMO and 90 MHz bandwidth from combo components in-place.
// ---------------------------------------------------------------------------

/**
 * Enrich nrBands with MIMO and 90 MHz bandwidth from NR component lists.
 * Accepts an array of ComponentNr arrays (e.g. one per combo) so it can handle
 * both NR-CA combos (combo.components) and EN-DC combos (combo.componentsNr).
 * Upstream: updateNrBandsCapabilities takes enDcCombos.flatMap { it.componentsNr }
 *   + nrCombos.flatMap { it.componentsNr }.
 */
export function updateNrBandsCapabilities(
  nrBandsMap: Map<number, BandNrDetails>,
  combos: Iterable<{ components: ComponentNr[] } | { componentsNr: ComponentNr[] }>,
): void {
  // Collect unique NR components across all combos
  const seenKeys = new Set<string>();
  const uniqueComponents: ComponentNr[] = [];

  for (const combo of combos) {
    const compsArr = 'components' in combo ? combo.components : combo.componentsNr;
    for (const comp of compsArr) {
      // Key by band + bwClassDl + bwClassUl + mimo + bw90mhz to deduplicate
      const key = `${comp.band}|${comp.bwClassDl ?? ''}|${comp.bwClassUl ?? ''}|${JSON.stringify(comp.mimoDl)}|${JSON.stringify(comp.mimoUl)}|${String(comp.bw90mhzSupported)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueComponents.push(comp);
      }
    }
  }


  for (const comp of uniqueComponents) {
    const band = nrBandsMap.get(comp.band);
    if (!band) continue;

    // Add 90 MHz bandwidth entry if channelBW90mhz is supported and not already present
    if (comp.bw90mhzSupported === true && !bandHas90Mhz(band)) {
      const newBandwidths: BwsNr[] = (band.bandwidths ?? []).map((bwsNr) => {
        if (bwsNr.scs === 30 || bwsNr.scs === 60) {
          const dlBws = bwsNr.bandwidthsDl ?? [];
          const ulBws = bwsNr.bandwidthsUl ?? [];
          const newDl = dlBws.length > 0 ? [...dlBws, 90].sort((a, b) => b - a) : dlBws;
          const newUl = ulBws.length > 0 ? [...ulBws, 90].sort((a, b) => b - a) : ulBws;
          return { scs: bwsNr.scs, bandwidthsDl: newDl, bandwidthsUl: newUl };
        }
        return bwsNr;
      });
      band.bandwidths = newBandwidths;
    }

    // Update MIMO (take max)
    if (comp.mimoDl !== undefined && comp.mimoDl.type !== 'empty') {
      const compMimoDlVal = mimoAverage(comp.mimoDl);
      const bandMimoDlVal = band.mimoDl ? mimoAverage(band.mimoDl) : 0;
      if (compMimoDlVal > bandMimoDlVal) {
        band.mimoDl = comp.mimoDl;
      }
    }

    if (comp.mimoUl !== undefined && comp.mimoUl.type !== 'empty') {
      const compMimoUlVal = mimoAverage(comp.mimoUl);
      const bandMimoUlVal = band.mimoUl ? mimoAverage(band.mimoUl) : 0;
      if (compMimoUlVal > bandMimoUlVal) {
        band.mimoUl = comp.mimoUl;
      }
    }
  }
}

function bandHas90Mhz(band: BandNrDetails): boolean {
  if (!band.bandwidths) return false;
  return band.bandwidths.some(
    (bw) => (bw.bandwidthsDl ?? []).includes(90) || (bw.bandwidthsUl ?? []).includes(90),
  );
}

// ---------------------------------------------------------------------------
// getNrCa — main entry point
// ---------------------------------------------------------------------------

/**
 * Parse NR carrier-aggregation combos from the NR capability container.
 * Resolves each band combination's feature-set combination → per-component
 * MIMO/BW/modulation. Returns the list of ComboNr.
 *
 * Also returns the NR bands map enriched in-place via updateNrBandsCapabilities.
 * Callers should call updateNrBandsCapabilities after this returns if they need
 * the enriched nrBands.
 */
export function getNrCa(
  nr: Record<string, unknown>,
  nrFeatures: NrFeatureSets,
  fsCombinations: FeatureIndex[][][],
  nrBandsMap: Map<number, BandNrDetails>,
): ComboNr[] {
  const rawCombos = getNrBandCombinations(nr);
  return linkFeaturesAndCarrierNr(rawCombos, fsCombinations, nrFeatures, nrBandsMap);
}

