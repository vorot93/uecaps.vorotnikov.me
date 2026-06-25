/**
 * LTE carrier-aggregation combo interpretation.
 * Ported from upstream ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser):
 *   getBandCombinations, getBandCombinationsAdd, getBandCombinationsReduced,
 *   parseBandParameters, parseBandParametersDL, parseBandParametersUL,
 *   parseMimoR12, setModulationFromBandList, set256qamUL, set1024qam,
 *   parseCaMimoV10i0, parseCaMimoV1270, mergeBcs, updateLteBandsCapabilities.
 */

import type {
  BandLteDetails,
  BCS,
  ComboLte,
  ComponentLte,
  Mimo,
  Modulation,
  ModulationOrder,
} from '../types/uecapabilityparser';
import {
  getObject,
  getArray,
  getInt,
  getString,
  getArrayAtPath,
} from '../json';
import { nceChain } from './versions';

// ---------------------------------------------------------------------------
// Versioned-extension resolution helpers
// (mirrors UEEutraCapabilityJson.kt, reusing lte-bands.ts approach)
// ---------------------------------------------------------------------------

function resolveVersions(eutra: Record<string, unknown>) {
  // v9e0: nce×2 + lateNonCriticalExtension + nce×3
  const v9e0 = nceChain(eutra, 2, 'lateNonCriticalExtension', 3);

  // v10i0: v9e0 + nce×4
  const v10i0 = v9e0 ? nceChain(v9e0, 4) : undefined;

  // v11d0: v10i0 + nce×1
  const v11d0 = v10i0 ? getObject(v10i0, 'nonCriticalExtension') : undefined;

  // v1020: nce×3
  const v1020 = nceChain(eutra, 3);

  // v1060: v1020 + nce×1
  const v1060 = v1020 ? getObject(v1020, 'nonCriticalExtension') : undefined;

  // v1090: v1060 + nce×1
  const v1090 = v1060 ? getObject(v1060, 'nonCriticalExtension') : undefined;

  // v1170: v1090 + nce×2
  const v1170 = v1090 ? nceChain(v1090, 2) : undefined;

  // v1180: v1170 + nce×1
  const v1180 = v1170 ? getObject(v1170, 'nonCriticalExtension') : undefined;

  // v11a0: v1180 + nce×1
  const v11a0 = v1180 ? getObject(v1180, 'nonCriticalExtension') : undefined;

  // v1250: v11a0 + nce×1
  const v1250 = v11a0 ? getObject(v11a0, 'nonCriticalExtension') : undefined;

  // v1260: v1250 + nce×1
  const v1260 = v1250 ? getObject(v1250, 'nonCriticalExtension') : undefined;

  // v1270: v1260 + nce×1
  const v1270 = v1260 ? getObject(v1260, 'nonCriticalExtension') : undefined;

  // v1280: v1270 + nce×1
  const v1280 = v1270 ? getObject(v1270, 'nonCriticalExtension') : undefined;

  // v1310: v1280 + nce×1
  const v1310 = v1280 ? getObject(v1280, 'nonCriticalExtension') : undefined;

  // v1320: v1310 + nce×1
  const v1320 = v1310 ? getObject(v1310, 'nonCriticalExtension') : undefined;

  // v1330: v1320 + nce×1
  const v1330 = v1320 ? getObject(v1320, 'nonCriticalExtension') : undefined;

  // v1340: v1330 + nce×1
  const v1340 = v1330 ? getObject(v1330, 'nonCriticalExtension') : undefined;

  // v1350: v1340 + nce×1
  const v1350 = v1340 ? getObject(v1340, 'nonCriticalExtension') : undefined;

  // v1430: v1350 + nce×2
  const v1430 = v1350 ? nceChain(v1350, 2) : undefined;

  // v1450: v1430 + nce×2
  const v1450 = v1430 ? nceChain(v1430, 2) : undefined;

  // v1460: v1450 + nce×1
  const v1460 = v1450 ? getObject(v1450, 'nonCriticalExtension') : undefined;

  // v1510: v1460 + nce×1
  const v1510 = v1460 ? getObject(v1460, 'nonCriticalExtension') : undefined;

  // v1530: v1510 + nce×2
  const v1530 = v1510 ? nceChain(v1510, 2) : undefined;

  return {
    v9e0,
    v10i0,
    v11d0,
    v1020,
    v1060,
    v1090,
    v1170,
    v1180,
    v11a0,
    v1250,
    v1260,
    v1270,
    v1280,
    v1310,
    v1430,
    v1530,
  };
}

// ---------------------------------------------------------------------------
// Mimo helpers — produce tagged-union objects as required by the type.
// The .d.ts Mimo.Type is an ambient enum — its members are runtime-undefined,
// so we use string literals cast to the enum type.
// ---------------------------------------------------------------------------

type MimoType = Mimo['type'];

/** EmptyMimo: {type:'empty'} */
const EMPTY_MIMO: Mimo = { type: 'empty' as MimoType } as Mimo.empty;

/** Create a Mimo from int. 0 → empty, else → single(n). */
function mimoFrom(n: number): Mimo {
  if (n === 0) return EMPTY_MIMO;
  // Upstream Mimo.from(int): if int > 10, split digits (not used here)
  return { type: 'single' as MimoType, value: n } as Mimo.single;
}

/** Create a Mimo from list. Empty → empty, all-same → single, else → mixed (sorted desc). */
function mimoFromList(list: number[]): Mimo {
  if (list.length === 0) return EMPTY_MIMO;
  const first = list[0]!;
  if (list.length === 1 || list.every((v) => v === first)) return mimoFrom(first);
  const sorted = [...list].sort((a, b) => b - a);
  return { type: 'mixed' as MimoType, value: sorted } as Mimo.mixed;
}

/** Average of a Mimo (for comparison). */
function mimoAverage(m: Mimo): number {
  if (m.type === 'empty') return 0;
  if (m.type === 'single') return m.value;
  return m.value.reduce((a, b) => a + b, 0) / m.value.length;
}

/**
 * Parse a MIMO string literal ("oneLayer", "twoLayers", "fourLayers", "eightLayers") → int.
 * Matches upstream `Int.fromLiteral(string)`.
 */
function fromLiteral(s: string | undefined): number {
  if (!s) return 0;
  const lower = s.toLowerCase();
  if (lower.includes('one')) return 1;
  if (lower.includes('two')) return 2;
  if (lower.includes('four')) return 4;
  if (lower.includes('eight')) return 8;
  return 0;
}

// ---------------------------------------------------------------------------
// Modulation helpers
// The .d.ts Modulation.Type is an ambient enum; use string literals cast via
// Modulation['type'] to avoid runtime-undefined enum members.
// ---------------------------------------------------------------------------

type ModType = Modulation['type'];

/** EmptyModulation: {type:'empty'} */
const EMPTY_MOD: Modulation = { type: 'empty' as ModType } as Modulation.empty;

/** Modulation orders by ordinal (matches upstream ModulationOrder ordinals). */
const MOD_ORDER = ['none', 'qam16', 'qam64', 'qam256', 'qam1024'] as const;
type ModStr = ModulationOrder; // alias — ModulationOrder = string union in d.ts

function modFrom(order: ModStr): Modulation {
  if (order === 'none') return EMPTY_MOD;
  return { type: 'single' as ModType, value: order } as Modulation.single;
}

/** Ordinal of a ModulationOrder string — higher = better. */
function modOrdinal(order: ModStr): number {
  return MOD_ORDER.indexOf(order as (typeof MOD_ORDER)[number]);
}

/** Average of a Modulation (for comparison). */
function modAverage(m: Modulation): number {
  if (m.type === 'empty') return 0;
  if (m.type === 'single') return modOrdinal(m.value);
  if (m.type === 'mixed') return m.value.reduce((s, v) => s + modOrdinal(v), 0) / m.value.length;
  return 0;
}

/** Max ModulationOrder from a Modulation. */
function modMax(m: Modulation): ModStr {
  if (m.type === 'empty') return 'none' as ModStr;
  if (m.type === 'single') return m.value;
  if (m.type === 'mixed') {
    let best: ModStr = 'none' as ModStr;
    for (const v of m.value) {
      if (modOrdinal(v) > modOrdinal(best)) best = v;
    }
    return best;
  }
  return 'none' as ModStr;
}

function modFromList(list: ModStr[]): Modulation {
  if (list.length === 0) return EMPTY_MOD;
  const first = list[0]!;
  if (list.length === 1 || list.every((v) => v === first)) return modFrom(first);
  const sorted = [...list].sort((a, b) => modOrdinal(b) - modOrdinal(a));
  return { type: 'mixed' as ModType, value: sorted } as Modulation.mixed;
}

// ---------------------------------------------------------------------------
// BCS helpers — port of BCS.fromBinaryString
// The .d.ts BCS.Type is an ambient enum; use BCS['type'] cast to avoid
// runtime-undefined enum members.
// ---------------------------------------------------------------------------

type BCSType = BCS['type'];

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

// ---------------------------------------------------------------------------
// Mutable component representation (we build these and then freeze them)
// ---------------------------------------------------------------------------

interface MutableComponent {
  band: number;
  bwClassDl: string | undefined;
  bwClassUl: string | undefined;
  mimoDl: Mimo;
  mimoUl: Mimo;
  modDl: Modulation;
  modUl: Modulation;
}

function makeComponent(band: number): MutableComponent {
  return {
    band,
    bwClassDl: undefined,
    bwClassUl: undefined,
    mimoDl: EMPTY_MIMO,
    mimoUl: EMPTY_MIMO,
    modDl: EMPTY_MOD,
    modUl: EMPTY_MOD,
  };
}

/** Freeze a MutableComponent → ComponentLte (omit undefined fields). */
function freezeComponent(c: MutableComponent): ComponentLte {
  const out: ComponentLte = { band: c.band };
  if (c.bwClassDl !== undefined) out.bwClassDl = c.bwClassDl;
  if (c.bwClassUl !== undefined) out.bwClassUl = c.bwClassUl;
  if (c.mimoDl.type !== 'empty') out.mimoDl = c.mimoDl;
  if (c.mimoUl.type !== 'empty') out.mimoUl = c.mimoUl;
  if (c.modDl.type !== 'empty') out.modulationDl = c.modDl;
  if (c.modUl.type !== 'empty') out.modulationUl = c.modUl;
  return out;
}

// ---------------------------------------------------------------------------
// parseBandParametersDL / parseBandParametersUL / parseBandParameters
// ---------------------------------------------------------------------------

function parseBandParametersDL(
  bp: Record<string, unknown>,
  release: number,
): { dlClass: string | undefined; dlMimo: Mimo } {
  let bpDl: Record<string, unknown> | undefined;
  if (release === 14) {
    bpDl = bp;
  } else if (release === 13) {
    bpDl = getObject(bp, 'bandParametersDL-r13');
  } else {
    // r10 or r11: getArrayAtPath("bandParametersDL-r${release}").first()
    // Container key uses the release suffix; inner field suffix stays r10.
    const arr = getArrayAtPath(bp, `bandParametersDL-r${release}`);
    bpDl = arr && arr.length > 0 ? (arr[0] as Record<string, unknown>) : undefined;
  }

  if (!bpDl) return { dlClass: undefined, dlMimo: EMPTY_MIMO };

  // field suffix: r10 for releases 10,11; r13 for release 13+
  const sub = release >= 13 ? `r${release}` : 'r10';

  const dlClassRaw = getString(bpDl, `ca-BandwidthClassDL-${sub}`);
  // Upstream BwClass.valueOf uppercases the first char: 'a' → 'A'
  const dlClassStr = dlClassRaw ? dlClassRaw[0]!.toUpperCase() : undefined;
  const dlClass = dlClassStr !== undefined && dlClassStr !== '0' ? dlClassStr : undefined;

  let dlMimoInt = 0;
  if (release < 14) {
    const mimoStr = getString(bpDl, `supportedMIMO-CapabilityDL-${sub}`);
    dlMimoInt = fromLiteral(mimoStr);

    // r13: also check fourLayerTM3-TM4-r13
    if (release === 13 && dlMimoInt < 4) {
      if (getString(bpDl, 'fourLayerTM3-TM4-r13') !== undefined) dlMimoInt = 4;
    }

    // If BwClass != NONE and no mimo reported → default 2
    if (dlClass !== undefined && dlMimoInt === 0) dlMimoInt = 2;
  }

  let dlMimo: Mimo = mimoFrom(dlMimoInt);

  // r13: check intraBandContiguousCC-InfoList-r13
  if (release === 13) {
    const ccList = getArray(bpDl, 'intraBandContiguousCC-InfoList-r13');
    if (ccList) {
      dlMimo = parseMimoR12(ccList, dlMimo);
    }
  }

  return { dlClass, dlMimo };
}

function parseBandParametersUL(
  bp: Record<string, unknown>,
  release: number,
): { ulClass: string | undefined; ulMimo: Mimo } {
  let bpUl: Record<string, unknown> | undefined;
  if (release === 14) {
    bpUl = bp;
  } else if (release === 13) {
    bpUl = getObject(bp, 'bandParametersUL-r13');
  } else {
    // r10 or r11: getArrayAtPath("bandParametersUL-r${release}").first()
    // Container key uses the release suffix; inner field suffix stays r10.
    const arr = getArrayAtPath(bp, `bandParametersUL-r${release}`);
    bpUl = arr && arr.length > 0 ? (arr[0] as Record<string, unknown>) : undefined;
  }

  if (!bpUl) return { ulClass: undefined, ulMimo: EMPTY_MIMO };

  const subBw = release >= 14 ? `r${release}` : 'r10';
  const subMimo = release >= 13 ? `r${release}` : 'r10';

  const ulClassRaw = getString(bpUl, `ca-BandwidthClassUL-${subBw}`);
  // Upstream BwClass.valueOf uppercases the first char
  const ulClassStr = ulClassRaw ? ulClassRaw[0]!.toUpperCase() : undefined;
  const ulClass = ulClassStr !== undefined && ulClassStr !== '0' ? ulClassStr : undefined;

  let ulMimoInt = 0;
  if (release < 14) {
    const mimoStr = getString(bpUl, `supportedMIMO-CapabilityUL-${subMimo}`);
    ulMimoInt = fromLiteral(mimoStr);
    // Upstream: if ulMimo == 0, default to 1 (not reported when = 1)
    if (ulMimoInt === 0) ulMimoInt = 1;
  }

  return { ulClass, ulMimo: mimoFrom(ulMimoInt) };
}

function parseBandParameters(bp: unknown, release: number): MutableComponent {
  const bpRec = bp as Record<string, unknown>;
  const band = getInt(bpRec, `bandEUTRA-r${release}`) ?? 0;
  const { dlClass, dlMimo } = parseBandParametersDL(bpRec, release);
  const { ulClass, ulMimo } = parseBandParametersUL(bpRec, release);

  const comp = makeComponent(band);
  comp.bwClassDl = dlClass;
  comp.bwClassUl = ulClass;
  comp.mimoDl = dlMimo;
  comp.mimoUl = ulMimo;
  return comp;
}

// ---------------------------------------------------------------------------
// parseMimoR12 — parse intraBandContiguousCC-InfoList-r12/r13
// ---------------------------------------------------------------------------

function parseMimoR12(ccInfoList: unknown[], defaultMimo: Mimo): Mimo {
  if (ccInfoList.length < 2) return defaultMimo;

  const defaultVal = Math.round(mimoAverage(defaultMimo));
  let allDefault = true;

  const mixedList: number[] = ccInfoList.map((item) => {
    const str = getString(item as Record<string, unknown>, 'supportedMIMO-CapabilityDL-r12');
    if (str === undefined) return defaultVal;
    allDefault = false;
    return fromLiteral(str);
  });

  if (allDefault) return defaultMimo;
  return mimoFromList(mixedList);
}

// ---------------------------------------------------------------------------
// setModulationFromBandList
// ---------------------------------------------------------------------------

function setModulationFromBandList(
  combinations: MutableComponent[][],
  bandMap: Map<number, MutableBandInfo>,
): void {
  for (const combo of combinations) {
    for (const comp of combo) {
      const band = bandMap.get(comp.band);
      comp.modDl = band ? band.modDl : EMPTY_MOD;
      if (comp.bwClassUl !== undefined) {
        comp.modUl = band ? band.modUl : EMPTY_MOD;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// set256qamUL — port of set256qamUL
// ---------------------------------------------------------------------------

function set256qamUL(v1430Array: unknown[], combinations: MutableComponent[][]): void {
  for (let i = 0; i < v1430Array.length; i++) {
    const bandParamList = getArray(v1430Array[i] as Record<string, unknown>, 'bandParameterList-v1430');
    if (!bandParamList) continue;
    for (let j = 0; j < bandParamList.length; j++) {
      const bp = bandParamList[j] as Record<string, unknown>;
      const combo = combinations[i];
      const comp = combo?.[j];
      if (!comp) continue;

      if (getString(bp, 'ul-256QAM-r14') !== undefined) {
        comp.modUl = modFrom('qam256' as ModStr);
      } else {
        const perCCList = getArray(bp, 'ul-256QAM-perCC-InfoList-r14');
        const defaultMod = modMax(comp.modUl);
        if (perCCList && perCCList.length > 0) {
          const mixedList = perCCList.map((it) => {
            const rec = it as Record<string, unknown>;
            if (getString(rec, 'ul-256QAM-perCC-r14') !== undefined) return 'qam256' as ModStr;
            return defaultMod;
          });
          comp.modUl = modFromList(mixedList);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// set1024qam — port of set1024qam
// ---------------------------------------------------------------------------

function set1024qam(v1530Array: unknown[], combinations: MutableComponent[][]): void {
  for (let i = 0; i < v1530Array.length; i++) {
    const bandParamList = getArray(v1530Array[i] as Record<string, unknown>, 'bandParameterList-v1530');
    if (!bandParamList) continue;
    for (let j = 0; j < bandParamList.length; j++) {
      const bp = bandParamList[j] as Record<string, unknown>;
      const comp = combinations[i]?.[j];
      if (!comp) continue;
      if (getString(bp, 'dl-1024QAM-r15') !== undefined) {
        comp.modDl = modFrom('qam1024' as ModStr);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// parseCaMimoV10i0 — port of parseCaMimoV10i0
// ---------------------------------------------------------------------------

function parseCaMimoV10i0(v10i0Array: unknown[], combinations: MutableComponent[][]): void {
  for (let i = 0; i < v10i0Array.length; i++) {
    const bandParamList = getArray(v10i0Array[i] as Record<string, unknown>, 'bandParameterList-v10i0');
    if (!bandParamList) continue;
    for (let j = 0; j < bandParamList.length; j++) {
      const bp = bandParamList[j] as Record<string, unknown>;
      const comp = combinations[i]?.[j];
      if (!comp) continue;

      const dlArr = getArray(bp, 'bandParametersDL-v10i0');
      if (dlArr && dlArr.length > 0) {
        const first = dlArr[0] as Record<string, unknown>;
        if (getString(first, 'fourLayerTM3-TM4-r10') !== undefined) {
          comp.mimoDl = mimoFrom(4);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// parseCaMimoV1270 — port of parseCaMimoV1270
// ---------------------------------------------------------------------------

function parseCaMimoV1270(v1270Array: unknown[], combinations: MutableComponent[][]): void {
  for (let i = 0; i < v1270Array.length; i++) {
    const bandParamList = getArray(v1270Array[i] as Record<string, unknown>, 'bandParameterList-v1270');
    if (!bandParamList) continue;
    for (let j = 0; j < bandParamList.length; j++) {
      const bp = bandParamList[j] as Record<string, unknown>;
      const comp = combinations[i]?.[j];
      if (!comp) continue;

      const dlArr = getArray(bp, 'bandParametersDL-v1270');
      if (dlArr && dlArr.length > 0) {
        const first = dlArr[0] as Record<string, unknown>;
        const ccList = getArray(first, 'intraBandContiguousCC-InfoList-r12');
        if (ccList) {
          comp.mimoDl = parseMimoR12(ccList, comp.mimoDl);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// hasHighMimo — check if any band has 4+ layers DL
// ---------------------------------------------------------------------------

function hasHighMimo(combinations: MutableComponent[][]): boolean {
  return combinations.some((combo) => combo.some((c) => mimoAverage(c.mimoDl) > 2));
}

// ---------------------------------------------------------------------------
// mergeBcs — zip combinations with bcs list → ComboLte[]
// ---------------------------------------------------------------------------

/**
 * Compare two bwClass letters descending (undefined sorts lowest).
 * Returns positive if a > b (a should come first in descending sort).
 */
function compareBwClassDesc(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return -1; // a sorts after b (lower)
  if (b === undefined) return 1;  // b sorts after a (lower)
  // Letter comparison: higher letter = higher class
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Port of ComponentLte.compareTo — DESCENDING compareValuesBy(band, bwClassDl,
 * bwClassUl, mimoDl, mimoUl), i.e. larger values sort first.
 */
function compareComponentDesc(a: MutableComponent, b: MutableComponent): number {
  // 1. band descending
  if (b.band !== a.band) return b.band - a.band;
  // 2. bwClassDl descending
  const bwDl = compareBwClassDesc(b.bwClassDl, a.bwClassDl);
  if (bwDl !== 0) return bwDl;
  // 3. bwClassUl descending
  const bwUl = compareBwClassDesc(b.bwClassUl, a.bwClassUl);
  if (bwUl !== 0) return bwUl;
  // 4. mimoDl descending (by average)
  const mimoDlDiff = mimoAverage(b.mimoDl) - mimoAverage(a.mimoDl);
  if (mimoDlDiff !== 0) return mimoDlDiff;
  // 5. mimoUl descending (by average)
  return mimoAverage(b.mimoUl) - mimoAverage(a.mimoUl);
}

function mergeBcs(combinations: MutableComponent[][], bcsList: BCS[]): ComboLte[] {
  const result: ComboLte[] = [];
  // zip-truncate to min(combinations.length, bcsList.length) — matches upstream zip()
  const len = Math.min(combinations.length, bcsList.length);
  for (let i = 0; i < len; i++) {
    const combo = combinations[i]!;
    const bcs = bcsList[i]!;
    // Sort components by full 5-key descending comparator (mirrors ComponentLte.compareTo)
    const sorted = [...combo].sort(compareComponentDesc);
    result.push({ components: sorted.map(freezeComponent), bcs });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Band info map for modulation lookup (built from lteBands list)
// ---------------------------------------------------------------------------

interface MutableBandInfo {
  modDl: Modulation;
  modUl: Modulation;
}

function buildBandMap(lteBands: BandLteDetails[]): Map<number, MutableBandInfo> {
  const map = new Map<number, MutableBandInfo>();
  for (const b of lteBands) {
    map.set(b.band, {
      modDl: b.modulationDl ?? EMPTY_MOD,
      modUl: b.modulationUl ?? EMPTY_MOD,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// getBandCombinations — port of getBandCombinations
// ---------------------------------------------------------------------------

function getBandCombinations(
  eutra: Record<string, unknown>,
  v: ReturnType<typeof resolveVersions>,
  bandMap: Map<number, MutableBandInfo>,
): ComboLte[] {
  // supportedBandCombination-r10
  const rawCombos = v.v1020
    ? getArrayAtPath(v.v1020, 'rf-Parameters-v1020.supportedBandCombination-r10')
    : undefined;
  if (!rawCombos) return [];

  const combinations: MutableComponent[][] = rawCombos
    .map((bc) => {
      if (!Array.isArray(bc)) return null;
      return bc.map((bp) => parseBandParameters(bp, 10));
    })
    .filter((c): c is MutableComponent[] => c !== null);

  // v1090: band override
  const v1090BandExt = v.v1090
    ? getArrayAtPath(v.v1090, 'rf-Parameters-v1090.supportedBandCombination-v1090')
    : undefined;
  if (v1090BandExt) {
    for (let i = 0; i < v1090BandExt.length; i++) {
      const bps = v1090BandExt[i];
      if (!Array.isArray(bps)) continue;
      for (let j = 0; j < bps.length; j++) {
        const bp = bps[j] as Record<string, unknown>;
        const band = getInt(bp, 'bandEUTRA-v1090');
        const comp = combinations[i]?.[j];
        if (band !== undefined && comp) comp.band = band;
      }
    }
  }

  // v10i0: high MIMO
  if (!hasHighMimo(combinations)) {
    const v10i0Arr = v.v10i0
      ? getArrayAtPath(v.v10i0, 'rf-Parameters-v10i0.supportedBandCombination-v10i0')
      : undefined;
    if (v10i0Arr) parseCaMimoV10i0(v10i0Arr, combinations);
  }

  // v1270: mixed MIMO
  const v1270Arr = v.v1270
    ? getArrayAtPath(v.v1270, 'rf-Parameters-v1270.supportedBandCombination-v1270')
    : undefined;
  if (v1270Arr) parseCaMimoV1270(v1270Arr, combinations);

  // Basic modulation from band list
  setModulationFromBandList(combinations, bandMap);

  // Advanced modulation
  const v1430Arr = v.v1430
    ? getArrayAtPath(v.v1430, 'rf-Parameters-v1430.supportedBandCombination-v1430')
    : undefined;
  if (v1430Arr) set256qamUL(v1430Arr, combinations);

  const v1530Arr = v.v1530
    ? getArrayAtPath(v.v1530, 'rf-Parameters-v1530.supportedBandCombination-v1530')
    : undefined;
  if (v1530Arr) set1024qam(v1530Arr, combinations);

  // BCS from v1060
  const bcsRaw = v.v1060
    ? (getArrayAtPath(v.v1060, 'rf-Parameters-v1060.supportedBandCombinationExt-r10') ?? [])
    : [];
  const bcsList: BCS[] = bcsRaw.map((item) => {
    const s = getString(item as Record<string, unknown>, 'supportedBandwidthCombinationSet-r10');
    return s ? bcsFromBinaryString(s) : ({ type: 'single', value: 0 } as BCS);
  });

  return mergeBcs(combinations, bcsList);
}

// ---------------------------------------------------------------------------
// getBandCombinationsAdd — port of getBandCombinationsAdd
// ---------------------------------------------------------------------------

function getBandCombinationsAdd(
  eutra: Record<string, unknown>,
  v: ReturnType<typeof resolveVersions>,
  bandMap: Map<number, MutableBandInfo>,
): ComboLte[] {
  const combinationsArray = v.v1180
    ? getArrayAtPath(v.v1180, 'rf-Parameters-v1180.supportedBandCombinationAdd-r11')
    : undefined;
  if (!combinationsArray) return [];

  const bcsList: BCS[] = [];
  const combinations: MutableComponent[][] = [];

  for (const bc of combinationsArray) {
    const rec = bc as Record<string, unknown>;
    const bcsStr =
      getString(rec, 'supportedBandwidthCombinationSet-r11') ?? '1';
    bcsList.push(bcsFromBinaryString(bcsStr));

    const bandParamList = getArrayAtPath(rec, 'bandParameterList-r11');
    if (bandParamList) {
      combinations.push(bandParamList.map((bp) => parseBandParameters(bp, 11)));
    }
    // If bandParamList is null, skip — mapNotNull in upstream
  }

  // v11d0: high MIMO (for add list)
  if (!hasHighMimo(combinations)) {
    const v11d0Arr = v.v11d0
      ? getArrayAtPath(v.v11d0, 'rf-Parameters-v11d0.supportedBandCombinationAdd-v11d0')
      : undefined;
    if (v11d0Arr) parseCaMimoV10i0(v11d0Arr, combinations);
  }

  // v1270: mixed MIMO
  const v1270Arr = v.v1270
    ? getArrayAtPath(v.v1270, 'rf-Parameters-v1270.supportedBandCombinationAdd-v1270')
    : undefined;
  if (v1270Arr) parseCaMimoV1270(v1270Arr, combinations);

  // Basic modulation
  setModulationFromBandList(combinations, bandMap);

  // Advanced modulation
  const v1430Arr = v.v1430
    ? getArrayAtPath(v.v1430, 'rf-Parameters-v1430.supportedBandCombinationAdd-v1430')
    : undefined;
  if (v1430Arr) set256qamUL(v1430Arr, combinations);

  const v1530Arr = v.v1530
    ? getArrayAtPath(v.v1530, 'rf-Parameters-v1530.supportedBandCombinationAdd-v1530')
    : undefined;
  if (v1530Arr) set1024qam(v1530Arr, combinations);

  return mergeBcs(combinations, bcsList);
}

// ---------------------------------------------------------------------------
// getBandCombinationsReduced — port of getBandCombinationsReduced
// ---------------------------------------------------------------------------

function getBandCombinationsReduced(
  eutra: Record<string, unknown>,
  v: ReturnType<typeof resolveVersions>,
  bandMap: Map<number, MutableBandInfo>,
): ComboLte[] {
  const combinationsArray = v.v1310
    ? getArrayAtPath(v.v1310, 'rf-Parameters-v1310.supportedBandCombinationReduced-r13')
    : undefined;
  if (!combinationsArray) return [];

  const bcsList: BCS[] = [];
  const combinations: MutableComponent[][] = [];

  for (const bc of combinationsArray) {
    const rec = bc as Record<string, unknown>;
    const bcsStr = getString(rec, 'supportedBandwidthCombinationSet-r13') ?? '1';
    bcsList.push(bcsFromBinaryString(bcsStr));

    const bandParamList = getArray(rec, 'bandParameterList-r13');
    if (bandParamList) {
      combinations.push(bandParamList.map((bp) => parseBandParameters(bp, 13)));
    }
  }

  // Basic modulation
  setModulationFromBandList(combinations, bandMap);

  // Advanced modulation
  const v1430Arr = v.v1430
    ? getArrayAtPath(v.v1430, 'rf-Parameters-v1430.supportedBandCombinationReduced-v1430')
    : undefined;
  if (v1430Arr) set256qamUL(v1430Arr, combinations);

  const v1530Arr = v.v1530
    ? getArrayAtPath(v.v1530, 'rf-Parameters-v1530.supportedBandCombinationReduced-v1530')
    : undefined;
  if (v1530Arr) set1024qam(v1530Arr, combinations);

  return mergeBcs(combinations, bcsList);
}

// ---------------------------------------------------------------------------
// updateLteBandsCapabilities — enrich lteBands from combos
// ---------------------------------------------------------------------------

/**
 * Enrich lteBands MIMO/modulation from the computed LTE CA combos.
 * Port of updateLteBandsCapabilities in ImportCapabilityInformation.kt.
 * Mutates the band objects in-place.
 */
export function updateLteBandsCapabilities(
  lteBands: BandLteDetails[],
  lteCombos: ComboLte[],
): void {
  // Build a map from the mutable band array
  const bandMap = new Map<number, BandLteDetails>();
  for (const b of lteBands) {
    bandMap.set(b.band, b);
  }

  // Collect all unique components from all combos
  const seen = new Set<string>();
  for (const combo of lteCombos) {
    for (const comp of combo.components) {
      const key = JSON.stringify(comp);
      if (seen.has(key)) continue;
      seen.add(key);

      const band = bandMap.get(comp.band);
      if (!band) continue;

      // mimoDl: take max
      if (comp.mimoDl) {
        if (
          band.mimoDl === undefined ||
          mimoAverage(comp.mimoDl) > mimoAverage(band.mimoDl)
        ) {
          band.mimoDl = comp.mimoDl;
        }
      }
      // mimoUl: take max
      if (comp.mimoUl) {
        if (
          band.mimoUl === undefined ||
          mimoAverage(comp.mimoUl) > mimoAverage(band.mimoUl)
        ) {
          band.mimoUl = comp.mimoUl;
        }
      }
      // modulationDl: take max
      if (comp.modulationDl) {
        if (
          band.modulationDl === undefined ||
          modAverage(comp.modulationDl) > modAverage(band.modulationDl)
        ) {
          band.modulationDl = comp.modulationDl;
        }
      }
      // modulationUl: take max
      if (comp.modulationUl) {
        if (
          band.modulationUl === undefined ||
          modAverage(comp.modulationUl) > modAverage(band.modulationUl)
        ) {
          band.modulationUl = comp.modulationUl;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// getLteCa — main entry point
// ---------------------------------------------------------------------------

/**
 * Port of getBandCombinations + getBandCombinationsAdd + getBandCombinationsReduced
 * combined into a single call. Returns all LTE CA combos.
 */
export function getLteCa(
  eutra: Record<string, unknown>,
  lteBands: BandLteDetails[],
): ComboLte[] {
  const v = resolveVersions(eutra);
  const bandMap = buildBandMap(lteBands);

  const listCombo = getBandCombinations(eutra, v, bandMap);
  const listComboAdd = getBandCombinationsAdd(eutra, v, bandMap);
  const listComboReduced = getBandCombinationsReduced(eutra, v, bandMap);

  return [...listCombo, ...listComboAdd, ...listComboReduced];
}
