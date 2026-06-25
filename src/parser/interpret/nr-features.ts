/**
 * NR feature-set and feature-set-combination parsing.
 *
 * Ported from upstream ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser):
 *   - `getNRFeatureSet` (~line 1217)
 *   - `getLteFeatureSet` (~line 1153)
 *   - `getFeatureSetCombinations` (~line 858)
 *   - `parseBw` (~line 1696)
 *   - Per-CC parsing for both DL and UL feature sets (downlinkPerCC / uplinkPerCC)
 *   - r17 bandwidth extensions (featureSetsDownlinkPerCC-v1700 / featureSetsUplinkPerCC-v1700)
 *
 * These intermediate structures are consumed by:
 *   - Task 5: `getNrCa` (nr-ca.ts) — NR carrier-aggregation combo resolution
 *   - Task 6: `getEnDc` (endc.ts) — EN-DC combo resolution (LTE + NR)
 *
 * No direct oracle field exists for these structures; they are validated
 * transitively by the Task 5 `nrca` oracle gate.
 *
 * Shared with ImportCapabilitySharedHelper.kt:
 *   - `mergeComponentAndFeaturePerCC` (Task 5 consumes this via the FeatureSets)
 *
 * --- Data shape summary (Task 5 contract) ---
 *
 * `FeaturePerCCNr`:
 *   { mimo: Mimo, bw: number, scs: number, channelBW90mhz: boolean }
 *   (qam is always NONE for NR per 3GPP TS 38.306)
 *
 * `FeaturePerCCLte`:
 *   { mimo: Mimo, qam: ModulationOrder (or 'none' for DL) }
 *
 * `FeatureSet`:
 *   { featureSetsPerCC: FeaturePerCCNr[] | FeaturePerCCLte[], isDownlink: boolean }
 *
 * `NrFeatureSets` (result of getNrFeatureSet / getLteFeatureSet):
 *   { downlink: FeatureSet[], uplink: FeatureSet[] }
 *   downlink[i] → 1-based index i+1 used by featureSetCombinations.downlinkSetNR
 *   uplink[i]   → 1-based index i+1 used by featureSetCombinations.uplinkSetNR
 *
 * `FeatureIndex` (element of getFeatureSetCombinations output):
 *   { isNR: boolean, downlinkIndex: number, uplinkIndex: number }
 *   Indices are 1-based (0 → absent).
 *
 * `FeatureSetCombinations` (result of getFeatureSetCombinations):
 *   FeatureIndex[][][]   — [combo][bandPosition][option]
 *   0-based combo index matches featureSetCombination field in band combination.
 */

import type { Mimo } from '../types/uecapabilityparser';
import { getObject, getArray, getString } from '../json';
import { nceChain } from './versions';

// ---------------------------------------------------------------------------
// Ambient-enum shims — Mimo produced as string-literal tagged unions
// ---------------------------------------------------------------------------

type MimoType = Mimo['type'];

const EMPTY_MIMO: Mimo = { type: 'empty' as MimoType } as Mimo.empty;

function mimoFrom(n: number): Mimo {
  if (n === 0) return EMPTY_MIMO;
  return { type: 'single' as MimoType, value: n } as Mimo.single;
}

// ---------------------------------------------------------------------------
// `Int.fromLiteral` port — maps MIMO layer string literals to integers
// Source: it.smartphonecombo.uecapabilityparser.model.Mimo.kt companion object
// ---------------------------------------------------------------------------

function fromLiteral(s: string | undefined | null): number {
  if (!s) return 0;
  const lower = s.toLowerCase();
  if (lower.includes('one')) return 1;
  if (lower.includes('two')) return 2;
  if (lower.includes('four')) return 4;
  if (lower.includes('eight')) return 8;
  return 0;
}

// ---------------------------------------------------------------------------
// `parseBw` port — parse "mhz100" → 100, etc.
// Source: ImportCapabilityInformation.kt ~line 1696
// ---------------------------------------------------------------------------

function parseBw(bandwidth: string | undefined | null): number {
  if (!bandwidth) return 0;
  return parseInt(bandwidth.replace(/^mhz/, ''), 10) || 0;
}

// ---------------------------------------------------------------------------
// Internal per-CC shape (TS representation of FeaturePerCCNr and FeaturePerCCLte)
// ---------------------------------------------------------------------------

/** Internal NR per-CC feature. Matches upstream FeaturePerCCNr shape. */
export interface FeaturePerCCNr {
  mimo: Mimo;
  /** ModulationOrder is always NONE for NR (per TS 38.306); not stored here. */
  bw: number;
  scs: number;
  channelBW90mhz: boolean;
}

/** Internal LTE per-CC feature. Matches upstream FeaturePerCCLte shape. */
export interface FeaturePerCCLte {
  mimo: Mimo;
  /** 'none' | 'qam256' (upstream ModulationOrder). */
  qam: 'none' | 'qam256';
}

export type IFeaturePerCC = FeaturePerCCNr | FeaturePerCCLte;

/** A downlink or uplink feature set: the per-CC list for one feature-set index. */
export interface FeatureSet<T extends IFeaturePerCC = IFeaturePerCC> {
  featureSetsPerCC: T[];
  /** true = downlink, false = uplink */
  isDownlink: boolean;
}

/** The full feature-set lists for one RAT (NR or LTE). */
export interface NrFeatureSets {
  downlink: FeatureSet<FeaturePerCCNr>[];
  uplink: FeatureSet<FeaturePerCCNr>[];
}

export interface LteFeatureSets {
  downlink: FeatureSet<FeaturePerCCLte>[];
  uplink: FeatureSet<FeaturePerCCLte>[];
}

/**
 * A single feature-set index (one cell in the featureSetCombinations 3D array).
 * Matches upstream `FeatureIndex(isNR, downlinkIndex, uplinkIndex)`.
 * Indices are 1-based; 0 means absent.
 */
export interface FeatureIndex {
  isNR: boolean;
  downlinkIndex: number;
  uplinkIndex: number;
}

// ---------------------------------------------------------------------------
// getNrFeatureSet — port of upstream `getNRFeatureSet(nrCapability)`
// Source: ImportCapabilityInformation.kt ~line 1217
// ---------------------------------------------------------------------------

/**
 * Parse NR feature sets from the NR capability container.
 *
 * The NR container (`nr` key in canonical) must contain a `featureSets` object with:
 *   - `featureSetsDownlinkPerCC` (array of per-CC descriptors)
 *   - `featureSetsDownlink` (array of feature-set-per-CC-list references, 1-based NR IDs)
 *   - `featureSetsUplinkPerCC`
 *   - `featureSetsUplink`
 *   - `featureSetsDownlinkPerCC-v1700` (optional r17 bandwidth extension)
 *   - `featureSetsUplinkPerCC-v1700` (optional r17 bandwidth extension)
 *
 * NR PerCC-ID is 1..1024 (NOT 0-based like LTE). The lookup uses `id - 1`.
 */
export function getNrFeatureSet(nr: Record<string, unknown>): NrFeatureSets {
  let downlink: FeatureSet<FeaturePerCCNr>[] = [];
  let uplink: FeatureSet<FeaturePerCCNr>[] = [];

  const featureSetsRoot = getObject(nr, 'featureSets');
  if (!featureSetsRoot) return { downlink, uplink };

  // -----------------------------------------------------------------------
  // Parse downlink per-CC entries (base r15)
  // -----------------------------------------------------------------------
  const downlinkPerCC: FeaturePerCCNr[] = [];

  const downlinkPerCCr15 = getArray(featureSetsRoot, 'featureSetsDownlinkPerCC');
  if (downlinkPerCCr15) {
    for (const item of downlinkPerCCr15) {
      const rec = item as Record<string, unknown>;
      // SCS: "kHz30" → 30, "kHz15" → 15, etc.
      const scsStr = getString(rec, 'supportedSubcarrierSpacingDL');
      const scs = scsStr
        ? parseInt(scsStr.replace('kHz', '').split('-')[0] ?? '0', 10) || 0
        : 0;

      // Bandwidth: supportedBandwidthDL.fr1 or .fr2
      const bwObj = getObject(rec, 'supportedBandwidthDL');
      const bwStr = bwObj
        ? (getString(bwObj, 'fr1') ?? getString(bwObj, 'fr2'))
        : undefined;
      let bw = parseBw(bwStr);

      // channelBW-90mhz: only counts if bw >= 80
      const channelBW90mhzRaw = getString(rec, 'channelBW-90mhz') !== undefined;
      const channelBW90mhz = channelBW90mhzRaw && bw >= 80;

      // If channelBW90mhz is set and bw == 80, upgrade to 90
      if (channelBW90mhz && bw === 80) bw = 90;

      // MIMO: maxNumberMIMO-LayersPDSCH; min 2 for DL per upstream
      const mimoStr = getString(rec, 'maxNumberMIMO-LayersPDSCH');
      const mimoInt = Math.max(fromLiteral(mimoStr), 2);

      downlinkPerCC.push({
        mimo: mimoFrom(mimoInt),
        bw,
        scs,
        channelBW90mhz,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Apply r17 DL bandwidth extension (featureSetsDownlinkPerCC-v1700)
  // Source: Import.kt ~line 1259
  // -----------------------------------------------------------------------
  const downlinkPerCCv1700 = getArray(featureSetsRoot, 'featureSetsDownlinkPerCC-v1700');
  if (downlinkPerCCv1700) {
    for (let idx = 0; idx < downlinkPerCCv1700.length; idx++) {
      const item = downlinkPerCCv1700[idx] as Record<string, unknown>;
      const bwObj17 = getObject(item, 'supportedBandwidthDL-v1710');
      const bwStr17 = bwObj17
        ? (getString(bwObj17, 'fr1-r17') ?? getString(bwObj17, 'fr2-r17'))
        : undefined;
      const bwR17 = parseBw(bwStr17);
      if (bwR17 !== 0) {
        const curr = downlinkPerCC[idx];
        if (curr !== undefined) {
          const bw90Supported = bwR17 >= 90 && curr.channelBW90mhz;
          downlinkPerCC[idx] = { ...curr, bw: bwR17, channelBW90mhz: bw90Supported };
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Build downlink feature sets (resolve per-CC ID references, 1-based)
  // -----------------------------------------------------------------------
  const featureSetsDownlink = getArray(featureSetsRoot, 'featureSetsDownlink');
  if (featureSetsDownlink) {
    const parsed: FeatureSet<FeaturePerCCNr>[] = [];
    for (const fsItem of featureSetsDownlink) {
      const rec = fsItem as Record<string, unknown>;
      const idList = getArray(rec, 'featureSetListPerDownlinkCC');
      if (!idList) continue;
      const perCCList: FeaturePerCCNr[] = [];
      for (const idRaw of idList) {
        if (typeof idRaw !== 'number') continue;
        const idx = idRaw - 1; // NR PerCC-ID is 1-based
        const cc = downlinkPerCC[idx];
        if (cc !== undefined) perCCList.push(cc);
      }
      if (perCCList.length > 0) {
        parsed.push({ featureSetsPerCC: perCCList, isDownlink: true });
      }
    }
    downlink = parsed;
  }

  // -----------------------------------------------------------------------
  // Parse uplink per-CC entries (base r15)
  // -----------------------------------------------------------------------
  const uplinkPerCC: FeaturePerCCNr[] = [];

  const uplinkPerCCr15 = getArray(featureSetsRoot, 'featureSetsUplinkPerCC');
  if (uplinkPerCCr15) {
    for (const item of uplinkPerCCr15) {
      const rec = item as Record<string, unknown>;
      // SCS
      const scsStr = getString(rec, 'supportedSubcarrierSpacingUL');
      const scs = scsStr
        ? parseInt(scsStr.replace('kHz', '').split('-')[0] ?? '0', 10) || 0
        : 0;

      // Bandwidth: supportedBandwidthUL.fr1 or .fr2
      const bwObj = getObject(rec, 'supportedBandwidthUL');
      const bwStr = bwObj
        ? (getString(bwObj, 'fr1') ?? getString(bwObj, 'fr2'))
        : undefined;
      let bw = parseBw(bwStr);

      // channelBW-90mhz: only counts if bw >= 80
      const channelBW90mhzRaw = getString(rec, 'channelBW-90mhz') !== undefined;
      const channelBW90mhz = channelBW90mhzRaw && bw >= 80;
      if (channelBW90mhz && bw === 80) bw = 90;

      // MIMO: from mimo-CB-PUSCH.maxNumberMIMO-LayersCB-PUSCH OR maxNumberMIMO-LayersNonCB-PUSCH
      // min 1 for UL per upstream
      const mimoCbObj = getObject(rec, 'mimo-CB-PUSCH');
      const mimoCbStr = mimoCbObj
        ? getString(mimoCbObj, 'maxNumberMIMO-LayersCB-PUSCH')
        : undefined;
      const mimoNonCbStr = getString(rec, 'maxNumberMIMO-LayersNonCB-PUSCH');
      const mimoInt = Math.max(fromLiteral(mimoCbStr), fromLiteral(mimoNonCbStr), 1);

      uplinkPerCC.push({
        mimo: mimoFrom(mimoInt),
        bw,
        scs,
        channelBW90mhz,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Apply r17 UL bandwidth extension (featureSetsUplinkPerCC-v1700)
  // Source: Import.kt ~line 1330
  // -----------------------------------------------------------------------
  const uplinkPerCCv1700 = getArray(featureSetsRoot, 'featureSetsUplinkPerCC-v1700');
  if (uplinkPerCCv1700) {
    for (let idx = 0; idx < uplinkPerCCv1700.length; idx++) {
      const item = uplinkPerCCv1700[idx] as Record<string, unknown>;
      const bwObj17 = getObject(item, 'supportedBandwidthUL-v1710');
      const bwStr17 = bwObj17
        ? (getString(bwObj17, 'fr1-r17') ?? getString(bwObj17, 'fr2-r17'))
        : undefined;
      const bwR17 = parseBw(bwStr17);
      if (bwR17 !== 0) {
        const curr = uplinkPerCC[idx];
        if (curr !== undefined) {
          const bw90Supported = bwR17 >= 90 && curr.channelBW90mhz;
          uplinkPerCC[idx] = { ...curr, bw: bwR17, channelBW90mhz: bw90Supported };
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Build uplink feature sets (resolve per-CC ID references, 1-based)
  // -----------------------------------------------------------------------
  const featureSetsUplink = getArray(featureSetsRoot, 'featureSetsUplink');
  if (featureSetsUplink) {
    const parsed: FeatureSet<FeaturePerCCNr>[] = [];
    for (const fsItem of featureSetsUplink) {
      const rec = fsItem as Record<string, unknown>;
      const idList = getArray(rec, 'featureSetListPerUplinkCC');
      if (!idList) continue;
      const perCCList: FeaturePerCCNr[] = [];
      for (const idRaw of idList) {
        if (typeof idRaw !== 'number') continue;
        const idx = idRaw - 1; // NR PerCC-ID is 1-based
        const cc = uplinkPerCC[idx];
        if (cc !== undefined) perCCList.push(cc);
      }
      if (perCCList.length > 0) {
        parsed.push({ featureSetsPerCC: perCCList, isDownlink: false });
      }
    }
    uplink = parsed;
  }

  return { downlink, uplink };
}

// ---------------------------------------------------------------------------
// getLteFeatureSet — port of upstream `getLteFeatureSet(eutraCapability)`
// Source: ImportCapabilityInformation.kt ~line 1153
// ---------------------------------------------------------------------------

/**
 * Parse LTE feature sets from the EUTRA capability container.
 *
 * Reads `featureSetsEUTRA-r15` from the v1510 extension of the eutra container.
 * v1510 is resolved via the same NCE chain used in lte-ca.ts / nr-bands.ts.
 *
 * LTE PerCC-ID is 0-based (unlike NR which is 1-based).
 *
 * The returned structure is consumed by EN-DC combo resolution (Task 6) for
 * LTE-side component feature resolution.
 */
export function getLteFeatureSet(eutra: Record<string, unknown>): LteFeatureSets {
  let downlink: FeatureSet<FeaturePerCCLte>[] = [];
  let uplink: FeatureSet<FeaturePerCCLte>[] = [];

  const v1510 = resolveEutraV1510(eutra);
  if (!v1510) return { downlink, uplink };

  const featureSetsEutra = getObject(v1510, 'featureSetsEUTRA-r15');
  if (!featureSetsEutra) return { downlink, uplink };

  // -----------------------------------------------------------------------
  // Parse DL per-CC entries
  // -----------------------------------------------------------------------
  const downlinkPerCC: FeaturePerCCLte[] = [];
  const dlPerCCArr = getArray(featureSetsEutra, 'featureSetsDL-PerCC-r15');
  if (dlPerCCArr) {
    for (const item of dlPerCCArr) {
      const rec = item as Record<string, unknown>;
      const mimoStr = getString(rec, 'supportedMIMO-CapabilityDL-MRDC-r15');
      // LTE DL min 2
      const mimoInt = Math.max(fromLiteral(mimoStr), 2);
      downlinkPerCC.push({ mimo: mimoFrom(mimoInt), qam: 'none' });
    }
  }

  // Build DL feature sets (0-based indexing for LTE)
  const dlArr = getArray(featureSetsEutra, 'featureSetsDL-r15');
  if (dlArr) {
    const parsed: FeatureSet<FeaturePerCCLte>[] = [];
    for (const fsItem of dlArr) {
      const rec = fsItem as Record<string, unknown>;
      const idList = getArray(rec, 'featureSetPerCC-ListDL-r15');
      if (!idList) continue;
      const perCCList: FeaturePerCCLte[] = [];
      for (const idRaw of idList) {
        if (typeof idRaw !== 'number') continue;
        // LTE PerCC-ID is 0-based
        const cc = downlinkPerCC[idRaw];
        if (cc !== undefined) perCCList.push(cc);
      }
      if (perCCList.length > 0) {
        parsed.push({ featureSetsPerCC: perCCList, isDownlink: true });
      }
    }
    downlink = parsed;
  }

  // -----------------------------------------------------------------------
  // Parse UL per-CC entries
  // -----------------------------------------------------------------------
  const uplinkPerCC: FeaturePerCCLte[] = [];
  const ulPerCCArr = getArray(featureSetsEutra, 'featureSetsUL-PerCC-r15');
  if (ulPerCCArr) {
    for (const item of ulPerCCArr) {
      const rec = item as Record<string, unknown>;
      const qam256Str = getString(rec, 'ul-256QAM-r15');
      const qam: 'none' | 'qam256' = qam256Str !== undefined ? 'qam256' : 'none';
      const mimoStr = getString(rec, 'supportedMIMO-CapabilityUL-r15');
      // LTE UL min 1
      const mimoInt = Math.max(fromLiteral(mimoStr), 1);
      uplinkPerCC.push({ mimo: mimoFrom(mimoInt), qam });
    }
  }

  // Build UL feature sets (0-based indexing for LTE)
  const ulArr = getArray(featureSetsEutra, 'featureSetsUL-r15');
  if (ulArr) {
    const parsed: FeatureSet<FeaturePerCCLte>[] = [];
    for (const fsItem of ulArr) {
      const rec = fsItem as Record<string, unknown>;
      const idList = getArray(rec, 'featureSetPerCC-ListUL-r15');
      if (!idList) continue;
      const perCCList: FeaturePerCCLte[] = [];
      for (const idRaw of idList) {
        if (typeof idRaw !== 'number') continue;
        const cc = uplinkPerCC[idRaw];
        if (cc !== undefined) perCCList.push(cc);
      }
      if (perCCList.length > 0) {
        parsed.push({ featureSetsPerCC: perCCList, isDownlink: false });
      }
    }
    uplink = parsed;
  }

  return { downlink, uplink };
}

// ---------------------------------------------------------------------------
// getFeatureSetCombinations — port of upstream `getFeatureSetCombinations(nrCapability)`
// Source: ImportCapabilityInformation.kt ~line 858
// ---------------------------------------------------------------------------

/**
 * Parse the feature-set combinations from a capability container.
 *
 * Works for both:
 *   - NR container (SA): `nr.featureSetCombinations`
 *   - MRDC/eutra-nr container (EN-DC): `eutra-nr.featureSetCombinations`
 *
 * Returns a 3D array: [comboIndex][bandPosition][featureOption]
 * Each cell is a FeatureIndex { isNR, downlinkIndex, uplinkIndex }.
 * Indices are 1-based (0 = absent/fallback).
 *
 * The outermost index (comboIndex) is used by band combinations via
 * `featureSetCombination` field (0-based in the canonical JSON after parsing).
 *
 * Note: upstream uses 0-based combo index: `featureSetCombinations.getOrNull(combo.featureSet)`.
 * The `featureSetCombination` field in a band combination is 1-based in the ASN.1, but by
 * the time it reaches canonical JSON (NR rrc-cap), it is already 0-based (it's an INTEGER
 * 0..1023 in 3GPP TS 38.331). We pass through the value exactly as stored in canonical.
 */
export function getFeatureSetCombinations(
  container: Record<string, unknown>,
): FeatureIndex[][][] {
  const rawCombinations = getArray(container, 'featureSetCombinations');
  if (!rawCombinations) return [];

  const result: FeatureIndex[][][] = [];

  for (const featureSetCombination of rawCombinations) {
    if (!Array.isArray(featureSetCombination)) continue;

    const bandPositions: FeatureIndex[][] = [];

    for (const featureSetsPerBand of featureSetCombination) {
      if (!Array.isArray(featureSetsPerBand)) continue;

      const options: FeatureIndex[] = [];

      for (const featureSet of featureSetsPerBand) {
        const rec = featureSet as Record<string, unknown>;
        const nrObj = getObject(rec, 'nr');
        const eutraObj = getObject(rec, 'eutra');

        if (nrObj !== undefined) {
          const dl = typeof nrObj['downlinkSetNR'] === 'number' ? nrObj['downlinkSetNR'] : 0;
          const ul = typeof nrObj['uplinkSetNR'] === 'number' ? nrObj['uplinkSetNR'] : 0;
          options.push({ isNR: true, downlinkIndex: dl, uplinkIndex: ul });
        } else if (eutraObj !== undefined) {
          const dl =
            typeof eutraObj['downlinkSetEUTRA'] === 'number' ? eutraObj['downlinkSetEUTRA'] : 0;
          const ul =
            typeof eutraObj['uplinkSetEUTRA'] === 'number' ? eutraObj['uplinkSetEUTRA'] : 0;
          options.push({ isNR: false, downlinkIndex: dl, uplinkIndex: ul });
        }
        // Otherwise skip (null entry in the upstream mapNotNull)
      }

      if (options.length > 0) bandPositions.push(options);
    }

    result.push(bandPositions);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the v1510 extension from the eutra capability container.
 *
 * Reuses the same NCE chain established in lte-ca.ts / nr-bands.ts:
 *   v1020 = nce(eutra, 3)
 *   v1350 = nce(v1020, 15)
 *   v1430 = nce(v1350, 2)
 *   v1450 = nce(v1430, 2)
 *   v1460 = nce(v1450, 1)
 *   v1510 = nce(v1460, 1)
 */
function resolveEutraV1510(eutra: Record<string, unknown>): Record<string, unknown> | undefined {
  const v1020 = nceChain(eutra, 3);
  if (!v1020) return undefined;
  const v1350 = nceChain(v1020, 15);
  if (!v1350) return undefined;
  const v1430 = nceChain(v1350, 2);
  if (!v1430) return undefined;
  const v1450 = nceChain(v1430, 2);
  if (!v1450) return undefined;
  const v1460 = nceChain(v1450, 1);
  if (!v1460) return undefined;
  return nceChain(v1460, 1);
}
