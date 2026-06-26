/**
 * EN-DC (EUTRA-NR dual connectivity) combo resolution.
 *
 * Ported from upstream ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser):
 *   - `getNrBandCombinations` (~line 887, EN-DC path) — parse band combos from rf-ParametersMRDC;
 *     parse both LTE (`eutra` field) and NR (`nr` field) components from bandList.
 *   - `linkFeaturesAndCarrier` (~line 700, EN-DC path) — expand combos across feature-set options
 *     using BOTH lteFeatures (from eutra container) and nrFeatures (from nr container).
 *   - `mergeComboNrAndIndexedFeature` (~line 730, EN-DC path) — merge one combo at given option
 *     index, routing each band-position to LTE or NR iterator based on featureSet.isNR.
 *   - `mergeComponentAndFeature` / `mergeComponentAndFeaturePerCC` (~line 819 / SharedHelper.kt)
 *   - `mergeAndSplitEnDcBCS` (SharedHelper.kt ~line 23) — compute the three BCS variants.
 *   - `applyLteFeaturesPerCC` (SharedHelper.kt ~line 152) — LTE-side feature application.
 *
 * Output:
 *   - `getEnDc(eutraNr, nrFeatures, lteFeatures, nrBandsMap, lteBandsMap): ComboEnDc[]`
 *
 * Ambient enums: all values produced as string literals. No DOM/Qwik. TS strict +
 * noUncheckedIndexedAccess.
 */

import type {
  BandNrDetails,
  BandLteDetails,
  Bandwidth,
  BCS,
  BwClass,
  ComboEnDc,
  ComponentLte,
  ComponentNr,
  Mimo,
  Modulation,
  ModulationOrder,
} from '../types/uecapabilityparser';
import { getArray, getArrayAtPath, getObject, getString, getInt } from '../json';
import { getFeatureSetCombinations } from './nr-features';
import type {
  FeatureIndex,
  FeaturePerCCLte,
  LteFeatureSets,
  NrFeatureSets,
} from './nr-features';
import { applyNrFeaturesPerCC } from './nr-ca';
import type { MutableComponentNr } from './nr-ca';
import { compareBwClassDesc } from './component-sort';

// ---------------------------------------------------------------------------
// Ambient-enum shims
// ---------------------------------------------------------------------------

type BCSType = BCS['type'];
type MimoType = Mimo['type'];
type ModType = Modulation['type'];

// ---------------------------------------------------------------------------
// BCS helpers
// ---------------------------------------------------------------------------

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

const EMPTY_BCS: BCS = { type: 'empty' as BCSType } as BCS.empty;

function bcsCompare(a: BCS, b: BCS): number {
  // Order: empty < single < multi < all
  const rank = (x: BCS): number => {
    if (x.type === 'empty') return 0;
    if (x.type === 'single') return 1;
    if (x.type === 'multi') return 2;
    return 3; // 'all'
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (a.type === 'single' && b.type === 'single')
    return (a as BCS.single).value - (b as BCS.single).value;
  if (a.type === 'multi' && b.type === 'multi')
    return (a as BCS.multi).value.length - (b as BCS.multi).value.length;
  return 0;
}

function bcsMax(a: BCS, b: BCS): BCS {
  return bcsCompare(a, b) >= 0 ? a : b;
}

// ---------------------------------------------------------------------------
// mergeAndSplitEnDcBCS — port of SharedHelper.kt ~line 23
// ---------------------------------------------------------------------------

function mergeAndSplitEnDcBCS(
  lteComponents: ComponentLte[],
  nrComponents: ComponentNr[],
  bcsNr: BCS,
  bcsEutra: BCS,
  bcsIntraEnDc: BCS,
): [BCS, BCS, BCS] {
  const intraBandEnDC = nrComponents.some((nr) =>
    lteComponents.some((lte) => nr.band === lte.band),
  );

  if (!intraBandEnDC) {
    // Don't set bcsIntraEnDc for combos without any intraEnDc component
    return [bcsNr, bcsEutra, EMPTY_BCS];
  }

  const interBandLte =
    lteComponents.length > 1 &&
    lteComponents.slice(1).some((c) => c.band !== lteComponents[0]!.band);
  const interBandNr =
    nrComponents.length > 1 &&
    nrComponents.slice(1).some((c) => c.band !== nrComponents[0]!.band);

  if (interBandLte || interBandNr) {
    // interBand + intraBand → set all BCS available
    return [bcsNr, bcsEutra, bcsIntraEnDc];
  } else {
    /* intraBandEnDc without additional interBand only has intraEnDc bcs
     * Set it to the max between bcsNr and bcsIntraEnDc to handle cases
     * where bcsIntraEnDc is missing */
    return [EMPTY_BCS, EMPTY_BCS, bcsMax(bcsIntraEnDc, bcsNr)];
  }
}

// ---------------------------------------------------------------------------
// Mimo / Modulation helpers for LTE
// ---------------------------------------------------------------------------

const EMPTY_MIMO: Mimo = { type: 'empty' as MimoType } as Mimo.empty;
const EMPTY_MOD: Modulation = { type: 'empty' as ModType } as Modulation.empty;

function mimoFrom(n: number): Mimo {
  if (n === 0) return EMPTY_MIMO;
  return { type: 'single' as MimoType, value: n } as Mimo.single;
}

function mimoFromList(list: number[]): Mimo {
  if (list.length === 0) return EMPTY_MIMO;
  const first = list[0]!;
  if (list.length === 1 || list.every((v) => v === first)) return mimoFrom(first);
  const sorted = [...list].sort((a, b) => b - a);
  return { type: 'mixed' as MimoType, value: sorted } as Mimo.mixed;
}

function mimoAverage(m: Mimo): number {
  if (m.type === 'empty') return 0;
  if (m.type === 'single') return (m as Mimo.single).value;
  if (m.type === 'mixed') {
    const arr = (m as Mimo.mixed).value;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  return 0;
}

const MOD_ORDER = ['none', 'qam16', 'qam64', 'qam256', 'qam1024'] as const;
type ModStr = ModulationOrder;

function modOrdinal(order: ModStr): number {
  return MOD_ORDER.indexOf(order as (typeof MOD_ORDER)[number]);
}

function modFrom(order: ModStr): Modulation {
  if (order === 'none') return EMPTY_MOD;
  return { type: 'single' as ModType, value: order } as Modulation & { type: 'single' };
}

function modFromList(list: ModStr[]): Modulation {
  if (list.length === 0) return EMPTY_MOD;
  const first = list[0]!;
  if (list.length === 1 || list.every((v) => v === first)) return modFrom(first);
  const sorted = [...list].sort((a, b) => modOrdinal(b) - modOrdinal(a));
  return { type: 'mixed' as ModType, value: sorted } as Modulation.mixed;
}

function modMax(a: Modulation, b: Modulation): Modulation {
  const aOrd = a.type === 'single' ? modOrdinal((a as Modulation.single).value) : -1;
  const bOrd = b.type === 'single' ? modOrdinal((b as Modulation.single).value) : -1;
  return aOrd >= bOrd ? a : b;
}

// ---------------------------------------------------------------------------
// LTE component freeze (from mutable to final ComponentLte)
// ---------------------------------------------------------------------------

interface MutableLte {
  band: number;
  bwClassDl?: string;
  bwClassUl?: string;
  mimoDl: Mimo;
  mimoUl: Mimo;
  modDl: Modulation;
  modUl: Modulation;
}

function freezeLteComponent(c: MutableLte): ComponentLte {
  const out: ComponentLte = { band: c.band };
  if (c.bwClassDl !== undefined && c.bwClassDl !== 'none') out.bwClassDl = c.bwClassDl as BwClass;
  if (c.bwClassUl !== undefined && c.bwClassUl !== 'none') out.bwClassUl = c.bwClassUl as BwClass;
  if (c.mimoDl.type !== 'empty') out.mimoDl = c.mimoDl;
  if (c.mimoUl.type !== 'empty') out.mimoUl = c.mimoUl;
  if (c.modDl.type !== 'empty') out.modulationDl = c.modDl;
  if (c.modUl.type !== 'empty') out.modulationUl = c.modUl;
  return out;
}

// ---------------------------------------------------------------------------
// applyLteFeaturesPerCC — port of SharedHelper.kt ~line 152
// ---------------------------------------------------------------------------

function applyLteFeaturesPerCC(
  direction: 'DL' | 'UL',
  component: MutableLte,
  feature: FeaturePerCCLte[] | undefined | null,
  bandMod: Modulation | undefined,
): void {
  if (!feature || feature.length === 0) {
    // setSdlSul: clear this direction
    if (direction === 'DL') {
      component.bwClassDl = 'none';
      component.mimoDl = EMPTY_MIMO;
    } else {
      component.bwClassUl = 'none';
      component.mimoUl = EMPTY_MIMO;
    }
    return;
  }

  let mimo: Mimo;
  let mod: Modulation;

  if (feature.length > 1) {
    // Multi-CC: Mimo.from(averages), Modulation.from(list of qam)
    const mimoValues = feature.map((f) => Math.trunc(mimoAverage(f.mimo)));
    mimo = mimoFromList(mimoValues);
    const modValues = feature.map((f) => f.qam as ModStr);
    mod = modFromList(modValues);
  } else {
    const f = feature[0]!;
    mimo = f.mimo;
    mod = modFrom(f.qam as ModStr);
  }

  // Set the max between features mod and band mod
  if (bandMod && bandMod.type !== 'empty') {
    mod = modMax(bandMod, mod);
  }

  if (direction === 'DL') {
    component.mimoDl = mimo;
    component.modDl = mod;
  } else {
    component.mimoUl = mimo;
    component.modUl = mod;
  }
}

// MutableComponentNr is imported from nr-ca.ts; use it here as MutableNr
type MutableNr = MutableComponentNr;

function freezeNrComponent(c: MutableNr): ComponentNr {
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
// Sort helpers
// ---------------------------------------------------------------------------

function bwClassOrdinal(cls: string | undefined): number {
  if (!cls || cls === 'none') return 0;
  return cls.charCodeAt(0);
}

function bwValue(bw: Bandwidth | undefined): number {
  if (!bw || bw.type === 'empty') return 0;
  if (bw.type === 'single') return (bw as Bandwidth.single).value;
  return 0;
}

function sortNrDesc(components: MutableNr[]): void {
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

function sortLteDesc(components: MutableLte[]): void {
  components.sort((a, b) => {
    if (b.band !== a.band) return b.band - a.band;
    const bwDl = compareBwClassDesc(b.bwClassDl, a.bwClassDl);
    if (bwDl !== 0) return bwDl;
    const bwUl = compareBwClassDesc(b.bwClassUl, a.bwClassUl);
    if (bwUl !== 0) return bwUl;
    const mimoDlDiff = mimoAverage(b.mimoDl) - mimoAverage(a.mimoDl);
    if (mimoDlDiff !== 0) return mimoDlDiff;
    return mimoAverage(b.mimoUl) - mimoAverage(a.mimoUl);
  });
}

// ---------------------------------------------------------------------------
// Raw combo type for EN-DC
// ---------------------------------------------------------------------------

interface RawEndcCombo {
  /** LTE components (band + bwClassDl + bwClassUl; no features yet) */
  lteComponents: MutableLte[];
  /** NR components (band + bwClassDl + bwClassUl; no features yet) */
  nrComponents: MutableNr[];
  /**
   * The order of band positions in featureSetCombinations matches the ORIGINAL
   * bandList order, alternating LTE and NR entries as they appear.
   * We track the type of each band position so linkFeaturesAndCarrier can
   * iterate lteComponents and nrComponents in the correct order.
   */
  bandTypes: Array<'lte' | 'nr'>;
  featureSet: number;
  bcsNr: BCS;
  bcsEutra: BCS;
  bcsIntraEnDc: BCS;
}

// ---------------------------------------------------------------------------
// getMrdcBandCombinations — parse EN-DC combos from eutraNr container
// Port of getNrBandCombinations (EN-DC path), upstream ~line 887
// ---------------------------------------------------------------------------

function getMrdcBandCombinations(eutraNr: Record<string, unknown>): RawEndcCombo[] {
  const bandCombinationsList = getArrayAtPath(eutraNr, 'rf-ParametersMRDC.supportedBandCombinationList');
  if (!bandCombinationsList) return [];

  // v1590: per-combo bcsIntraEnDc
  const v1590Iterator = (
    getArrayAtPath(eutraNr, 'rf-ParametersMRDC.supportedBandCombinationList-v1590') ?? []
  ).values();

  const result: RawEndcCombo[] = [];

  for (const bandCombination of bandCombinationsList) {
    const rec = bandCombination as Record<string, unknown>;
    const bandList = getArray(rec, 'bandList');
    if (!bandList) continue;

    const lteComponents: MutableLte[] = [];
    const nrComponents: MutableNr[] = [];
    const bandTypes: Array<'lte' | 'nr'> = [];

    for (const bandParameters of bandList) {
      const bp = bandParameters as Record<string, unknown>;
      const nrField = getObject(bp, 'nr');
      const eutraField = getObject(bp, 'eutra');

      if (nrField !== undefined) {
        const band = getInt(nrField, 'bandNR') ?? 0;
        const dlClassStr = getString(nrField, 'ca-BandwidthClassDL-NR');
        const ulClassStr = getString(nrField, 'ca-BandwidthClassUL-NR');
        const comp: MutableNr = { band };
        if (dlClassStr !== undefined) comp.bwClassDl = dlClassStr.toUpperCase();
        if (ulClassStr !== undefined) comp.bwClassUl = ulClassStr.toUpperCase();
        nrComponents.push(comp);
        bandTypes.push('nr');
      } else if (eutraField !== undefined) {
        const band = getInt(eutraField, 'bandEUTRA') ?? 0;
        const dlClassStr = getString(eutraField, 'ca-BandwidthClassDL-EUTRA');
        const ulClassStr = getString(eutraField, 'ca-BandwidthClassUL-EUTRA');
        const comp: MutableLte = {
          band,
          bwClassDl: dlClassStr ? dlClassStr.toUpperCase() : undefined,
          bwClassUl: ulClassStr ? ulClassStr.toUpperCase() : undefined,
          mimoDl: EMPTY_MIMO,
          mimoUl: EMPTY_MIMO,
          modDl: EMPTY_MOD,
          modUl: EMPTY_MOD,
        };
        lteComponents.push(comp);
        bandTypes.push('lte');
      }
    }

    const featureSet = getInt(rec, 'featureSetCombination') ?? 0;
    const bcsNrString = getString(rec, 'supportedBandwidthCombinationSet') ?? '1';
    const bcsNr = bcsFromBinaryString(bcsNrString);

    // bcsEutra from ca-ParametersEUTRA.supportedBandwidthCombinationSetEUTRA-v1530
    const caParamsEutra = getObject(rec, 'ca-ParametersEUTRA');
    const bcsEutraString =
      (caParamsEutra && getString(caParamsEutra, 'supportedBandwidthCombinationSetEUTRA-v1530')) ??
      '1';
    const bcsEutra = bcsFromBinaryString(bcsEutraString);

    // bcsIntraEnDc from v1590 list (parallel iterator)
    const v1590Entry = v1590Iterator.next().value as Record<string, unknown> | undefined;
    const bcsIntraEnDcString =
      v1590Entry !== undefined
        ? (getString(v1590Entry, 'supportedBandwidthCombinationSetIntraENDC') ?? '1')
        : '1';
    const bcsIntraEnDc = bcsFromBinaryString(bcsIntraEnDcString);

    result.push({
      lteComponents,
      nrComponents,
      bandTypes,
      featureSet,
      bcsNr,
      bcsEutra,
      bcsIntraEnDc,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// mergeOneEndcCombo — merge a single EN-DC combo for one feature-set option index.
// Port of mergeComboNrAndIndexedFeature (EN-DC path), upstream ~line 730.
// ---------------------------------------------------------------------------

function mergeOneEndcCombo(
  rawCombo: RawEndcCombo,
  featureSetsPerBand: FeatureIndex[][],
  optionIndex: number,
  nrFeatures: NrFeatureSets | null,
  lteFeatures: LteFeatureSets | null,
  nrBandsMap: Map<number, BandNrDetails>,
  lteBandsMap: Map<number, BandLteDetails>,
): [ComponentLte[], ComponentNr[]] | null {
  // Build working copies
  const newLte: MutableLte[] = rawCombo.lteComponents.map((c) => ({ ...c }));
  const newNr: MutableNr[] = rawCombo.nrComponents.map((c) => ({ ...c }));

  let lteIdx = 0;
  let nrIdx = 0;

  for (let bandPos = 0; bandPos < rawCombo.bandTypes.length; bandPos++) {
    const type = rawCombo.bandTypes[bandPos]!;
    const featureSetBand = featureSetsPerBand[bandPos];
    if (!featureSetBand) return null;

    const featureSet = featureSetBand[optionIndex];
    if (featureSet === undefined) return null;

    if (type === 'nr') {
      const comp = newNr[nrIdx++];
      if (!comp) return null;

      const dlIndex = featureSet.downlinkIndex - 1;
      const ulIndex = featureSet.uplinkIndex - 1;

      if (dlIndex < 0 && ulIndex < 0) {
        // Fallback combination — treat as pass-through (upstream returns null/clone)
        // For EN-DC, upstream returns a clone without editing (mergeComponentAndFeature)
        // Actually upstream returns null → we should skip the whole option
        return null;
      }

      const bandDetails = nrBandsMap.get(comp.band);
      const dlFeature =
        nrFeatures && dlIndex >= 0
          ? (nrFeatures.downlink[dlIndex]?.featureSetsPerCC ?? null)
          : null;
      const ulFeature =
        nrFeatures && ulIndex >= 0
          ? (nrFeatures.uplink[ulIndex]?.featureSetsPerCC ?? null)
          : null;

      const dlMissing = dlIndex >= 0 && (dlFeature === null || dlFeature.length === 0);
      const ulMissing = ulIndex >= 0 && (ulFeature === null || ulFeature.length === 0);

      if (!nrFeatures || dlMissing || ulMissing) {
        // Return clone without editing
      } else {
        applyNrFeaturesPerCC('DL', comp, dlFeature ?? undefined, bandDetails);
        applyNrFeaturesPerCC('UL', comp, ulFeature ?? undefined, bandDetails);
      }
    } else {
      // LTE
      const comp = newLte[lteIdx++];
      if (!comp) return null;

      const dlIndex = featureSet.downlinkIndex - 1;
      const ulIndex = featureSet.uplinkIndex - 1;

      if (dlIndex < 0 && ulIndex < 0) {
        return null;
      }

      const bandDetails = lteBandsMap.get(comp.band);
      const bandModDl = bandDetails?.modulationDl ?? undefined;
      const bandModUl = bandDetails?.modulationUl ?? undefined;

      const dlFeature =
        lteFeatures && dlIndex >= 0
          ? (lteFeatures.downlink[dlIndex]?.featureSetsPerCC ?? null)
          : null;
      const ulFeature =
        lteFeatures && ulIndex >= 0
          ? (lteFeatures.uplink[ulIndex]?.featureSetsPerCC ?? null)
          : null;

      const dlMissing = dlIndex >= 0 && (dlFeature === null || dlFeature.length === 0);
      const ulMissing = ulIndex >= 0 && (ulFeature === null || ulFeature.length === 0);

      if (!lteFeatures || dlMissing || ulMissing) {
        // Return clone without editing
      } else {
        applyLteFeaturesPerCC('DL', comp, dlFeature ?? undefined, bandModDl);
        applyLteFeaturesPerCC('UL', comp, ulFeature ?? undefined, bandModUl);
      }
    }
  }

  sortNrDesc(newNr);
  sortLteDesc(newLte);

  return [newLte.map(freezeLteComponent), newNr.map(freezeNrComponent)];
}

// ---------------------------------------------------------------------------
// linkFeaturesAndCarrierEnDc — port of linkFeaturesAndCarrier (EN-DC path)
// upstream ~line 700
// ---------------------------------------------------------------------------

function linkFeaturesAndCarrierEnDc(
  rawCombos: RawEndcCombo[],
  fsCombinations: FeatureIndex[][][],
  nrFeatures: NrFeatureSets | null,
  lteFeatures: LteFeatureSets | null,
  nrBandsMap: Map<number, BandNrDetails>,
  lteBandsMap: Map<number, BandLteDetails>,
): ComboEnDc[] {
  const result: ComboEnDc[] = [];

  for (const rawCombo of rawCombos) {
    const featureSetsPerBand = fsCombinations[rawCombo.featureSet];
    if (!featureSetsPerBand || featureSetsPerBand.length === 0) continue;

    const firstBandPos = featureSetsPerBand[0];
    if (!firstBandPos || firstBandPos.length === 0) continue;
    const optionCount = firstBandPos.length;

    for (let optIdx = 0; optIdx < optionCount; optIdx++) {
      const merged = mergeOneEndcCombo(
        rawCombo,
        featureSetsPerBand,
        optIdx,
        nrFeatures,
        lteFeatures,
        nrBandsMap,
        lteBandsMap,
      );
      if (merged === null) continue;

      const [lteComps, nrComps] = merged;

      // mergeAndSplitEnDcBCS
      const [bcsNr, bcsEutra, bcsIntraEndc] = mergeAndSplitEnDcBCS(
        lteComps,
        nrComps,
        rawCombo.bcsNr,
        rawCombo.bcsEutra,
        rawCombo.bcsIntraEnDc,
      );

      const combo: ComboEnDc = {
        componentsLte: lteComps,
        componentsNr: nrComps,
      };

      if (bcsNr.type !== 'empty') combo.bcsNr = bcsNr;
      if (bcsEutra.type !== 'empty') combo.bcsEutra = bcsEutra;
      if (bcsIntraEndc.type !== 'empty') combo.bcsIntraEndc = bcsIntraEndc;

      result.push(combo);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// getEnDc — main entry point
// ---------------------------------------------------------------------------

/**
 * Parse EN-DC combos from the eutra-nr capability container.
 *
 * @param eutraNr     The eutra-nr canonical container (featureSetCombinations + rf-ParametersMRDC)
 * @param nrFeatures  Already-parsed NR feature sets (from the NR container)
 * @param lteFeatures Already-parsed LTE feature sets (from the eutra container)
 * @param nrBandsMap  NR bands map (band → BandNrDetails) for modulation lookup
 * @param lteBandsMap LTE bands map (band → BandLteDetails) for modulation lookup
 */
export function getEnDc(
  eutraNr: Record<string, unknown>,
  nrFeatures: NrFeatureSets | null,
  lteFeatures: LteFeatureSets | null,
  nrBandsMap: Map<number, BandNrDetails>,
  lteBandsMap: Map<number, BandLteDetails>,
): ComboEnDc[] {
  const fsCombinations = getFeatureSetCombinations(eutraNr);
  const rawCombos = getMrdcBandCombinations(eutraNr);

  return linkFeaturesAndCarrierEnDc(
    rawCombos,
    fsCombinations,
    nrFeatures,
    lteFeatures,
    nrBandsMap,
    lteBandsMap,
  );
}

