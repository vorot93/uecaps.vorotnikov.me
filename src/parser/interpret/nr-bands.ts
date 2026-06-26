/**
 * NR band list interpretation.
 * Ported from upstream `getNrBands` (NR-container overload, ~line 979),
 * `parseNRChannelBWs` (~1070), and `parseNrBw` (~1135) in
 * ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser).
 *
 * Also ports the eutra-side NR-NSA band extraction (`getNrBands` eutra
 * overload, ~line 675) which produces `nrNsaBandsEutra`.
 */

import type {
  BandBoxed,
  BandNrDetails,
  BwsNr,
  Modulation,
  ModulationOrder,
  PowerClass,
} from '../types/uecapabilityparser';
import { getObject, getInt, getString, getArrayAtPath } from '../json';
import { nceChain } from './versions';

// ---------------------------------------------------------------------------
// Ambient-enum shims: all values are string literals matching oracle output.
// ---------------------------------------------------------------------------
type ModType = Modulation['type'];

function toModSingle(value: string): Modulation {
  return { type: 'single' as ModType, value: value as ModulationOrder } as Modulation & { type: 'single' };
}

const MOD_QAM256 = toModSingle('qam256');
const MOD_QAM64 = toModSingle('qam64');
const MOD_QAM1024 = toModSingle('qam1024');

// PowerClass string literals matching oracle
const PC3 = 'pc3' as PowerClass;
const PC2 = 'pc2' as PowerClass;
const PC1dot5 = 'pc1dot5' as PowerClass;
const PC_NONE = 'none' as PowerClass;

// FR2 boundary: bands > 256 are FR2
function isFR2(band: number): boolean {
  return band > 256;
}

// Bands that lack a 100 MHz field entry in channelBWs (3GPP TS 38.306 v16.6.0 §4.2.7.6)
const BANDS_DEFAULT_100 = new Set([41, 48, 77, 78, 79, 90]);

// Supplementary-uplink NR bands (upstream DuplexBandTable.nrData → Duplex.SUL).
// SUL bands carry no downlink: omit modulationDl (and DL bandwidths) — duplex==SUL ⇒ modDL=NONE.
const NR_SUL_BANDS = new Set([80, 81, 82, 83, 84, 86, 89, 95, 97, 98, 99]);

// BwsBitMap: FR1 bandwidth mapping table (index → MHz)
// Index i in the 10-char bit string corresponds to fr1BwMap[i]
const FR1_BW_MAP = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80];
// FR1 v1590 extension map
const FR1_V1590_BW_MAP = [70, 45, 35, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
// FR2 bandwidth mapping table
const FR2_BW_MAP = [50, 100, 200];

/** Parse a bandwidth bit-string into an array of MHz values (descending). */
function parseBwBitMap(
  bwBinaryString: string,
  band: number,
  scs: number,
  isV1590: boolean,
  isEmbb: boolean,
): number[] {
  const fr2 = isFR2(band);
  const bwMap = fr2 ? FR2_BW_MAP : isV1590 ? FR1_V1590_BW_MAP : FR1_BW_MAP;

  const bwsList: number[] = [];
  // Iterate in reverse (highest index first) to get values descending
  for (let i = bwBinaryString.length - 1; i >= 0; i--) {
    if (bwBinaryString[i] === '1') {
      const bw = bwMap[i];
      if (bw !== undefined && bw > 0) {
        bwsList.push(bw);
      }
    }
  }

  // Add implicit 100 MHz for specific bands (EMBB UEs only, non-v1590)
  const shouldAdd100 =
    isEmbb &&
    !isV1590 &&
    BANDS_DEFAULT_100.has(band) &&
    (scs === 30 || (scs === 60 && bwsList.length > 0));
  if (shouldAdd100) {
    bwsList.push(100);
  }

  return bwsList;
}

/** Per-SCS bandwidth map: scs → list of MHz values */
type BwMap = Map<number, number[]>;

/**
 * Parse the `channelBWs-DL` / `channelBWs-UL` objects into a per-SCS map.
 * Mirrors `parseNrBw` in the upstream Kotlin.
 */
function parseNrBwObject(
  channelBWs: Record<string, unknown> | undefined,
  band: number,
  isV1590: boolean,
  isEmbb: boolean,
): BwMap {
  const result: BwMap = new Map();
  if (!channelBWs) return result;

  const freqRange = isFR2(band) ? 'fr2' : 'fr1';
  const frObj = getObject(channelBWs, freqRange);
  if (!frObj) return result;

  for (const [scsKey, element] of Object.entries(frObj)) {
    if (typeof element !== 'string') continue;
    // Key format: "scs-15kHz", "scs-30kHz", etc.
    const scs = parseInt(scsKey.replace('scs-', '').replace('kHz', ''), 10);
    if (isNaN(scs)) continue;
    const bws = parseBwBitMap(element, band, scs, isV1590, isEmbb);
    result.set(scs, bws);
  }
  return result;
}

// ---------------------------------------------------------------------------
// BwTableNr: default bandwidth tables from 3GPP TS 38.101 v15.7.0
// (source: BwTableNr.kt). Only used when channelBWs omits an SCS entry.
// ---------------------------------------------------------------------------
interface DefaultBwEntry {
  dl: number[];
  ul: number[];
}

/** Returns default DL/UL bandwidths for a given band+scs from the spec table. */
function getDefaultBws(band: number, scs: number): DefaultBwEntry {
  // FR2 default
  if (isFR2(band)) {
    const fr2 = [200, 100, 50];
    return { dl: fr2, ul: fr2 };
  }
  // FR1 defaults (3GPP TS 38.101-1 v15.7.0)
  const fr1Common15 = [20, 15, 10, 5];
  const fr1Common30 = [20, 15, 10];
  const fr1Common60 = [20, 15, 10];

  const tables: Record<number, Record<number, DefaultBwEntry>> = {
    1: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
      60: { dl: fr1Common60, ul: fr1Common60 },
    },
    2: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
      60: { dl: fr1Common60, ul: fr1Common60 },
    },
    3: {
      15: { dl: [30, 25, 20, 15, 10, 5], ul: [30, 25, 20, 15, 10, 5] },
      30: { dl: [30, 25, 20, 15, 10], ul: [30, 25, 20, 15, 10] },
      60: { dl: [30, 25, 20, 15, 10], ul: [30, 25, 20, 15, 10] },
    },
    5: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
    },
    7: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
      60: { dl: fr1Common60, ul: fr1Common60 },
    },
    8: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
    },
    12: {
      15: { dl: [15, 10, 5], ul: [15, 10, 5] },
      30: { dl: [15, 10], ul: [15, 10] },
    },
    20: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
    },
    25: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
      60: { dl: fr1Common60, ul: fr1Common60 },
    },
    28: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
    },
    34: {
      15: { dl: [15, 10, 5], ul: [15, 10, 5] },
      30: { dl: [15, 10], ul: [15, 10] },
      60: { dl: [15, 10], ul: [15, 10] },
    },
    38: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
      60: { dl: fr1Common60, ul: fr1Common60 },
    },
    39: {
      15: { dl: [40, 30, 25, 20, 15, 10, 5], ul: [40, 30, 25, 20, 15, 10, 5] },
      30: { dl: [40, 30, 25, 20, 15, 10], ul: [40, 30, 25, 20, 15, 10] },
      60: { dl: [40, 30, 25, 20, 15, 10], ul: [40, 30, 25, 20, 15, 10] },
    },
    40: {
      15: { dl: [50, 40, 30, 25, 20, 15, 10, 5], ul: [50, 40, 30, 25, 20, 15, 10, 5] },
      30: { dl: [80, 60, 50, 40, 30, 25, 20, 15, 10], ul: [80, 60, 50, 40, 30, 25, 20, 15, 10] },
      60: { dl: [80, 60, 50, 40, 30, 25, 20, 15, 10], ul: [80, 60, 50, 40, 30, 25, 20, 15, 10] },
    },
    41: {
      15: { dl: [50, 40, 20, 15, 10], ul: [50, 40, 20, 15, 10] },
      30: { dl: [100, 80, 60, 50, 40, 20, 15, 10], ul: [100, 80, 60, 50, 40, 20, 15, 10] },
      60: { dl: [100, 80, 60, 50, 40, 20, 15, 10], ul: [100, 80, 60, 50, 40, 20, 15, 10] },
    },
    50: {
      15: { dl: [50, 40, 20, 15, 10, 5], ul: [50, 40, 20, 15, 10, 5] },
      30: { dl: [80, 60, 50, 40, 20, 15, 10], ul: [60, 50, 40, 20, 15, 10] },
      60: { dl: [80, 60, 50, 40, 20, 15, 10], ul: [60, 50, 40, 20, 15, 10] },
    },
    51: { 15: { dl: [5], ul: [5] } },
    66: {
      15: { dl: [40, 20, 15, 10, 5], ul: [40, 20, 15, 10, 5] },
      30: { dl: [40, 20, 15, 10], ul: [40, 20, 15, 10] },
      60: { dl: [40, 20, 15, 10], ul: [40, 20, 15, 10] },
    },
    70: {
      15: { dl: [25, 20, 15, 10, 5], ul: [15, 10, 5] },
      30: { dl: [25, 20, 15, 10], ul: [15, 10] },
      60: { dl: [25, 20, 15, 10], ul: [15, 10] },
    },
    71: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
    },
    74: {
      15: { dl: fr1Common15, ul: fr1Common15 },
      30: { dl: fr1Common30, ul: fr1Common30 },
      60: { dl: fr1Common60, ul: fr1Common60 },
    },
    75: {
      15: { dl: [20, 15, 10, 5], ul: [] },
      30: { dl: [20, 15, 10], ul: [] },
      60: { dl: [20, 15, 10], ul: [] },
    },
    76: { 15: { dl: [5], ul: [] } },
    77: {
      15: { dl: [50, 40, 20, 15, 10], ul: [50, 40, 20, 15, 10] },
      30: { dl: [100, 80, 60, 50, 40, 20, 15, 10], ul: [100, 80, 60, 50, 40, 20, 15, 10] },
      60: { dl: [100, 80, 60, 50, 40, 20, 15, 10], ul: [100, 80, 60, 50, 40, 20, 15, 10] },
    },
    78: {
      15: { dl: [50, 40, 20, 15, 10], ul: [50, 40, 20, 15, 10] },
      30: { dl: [100, 80, 60, 50, 40, 20, 15, 10], ul: [100, 80, 60, 50, 40, 20, 15, 10] },
      60: { dl: [100, 80, 60, 50, 40, 20, 15, 10], ul: [100, 80, 60, 50, 40, 20, 15, 10] },
    },
    79: {
      15: { dl: [50, 40], ul: [50, 40] },
      30: { dl: [100, 80, 60, 50, 40], ul: [100, 80, 60, 50, 40] },
      60: { dl: [100, 80, 60, 50, 40], ul: [100, 80, 60, 50, 40] },
    },
    80: {
      15: { dl: [], ul: [30, 25, 20, 15, 10, 5] },
      30: { dl: [], ul: [30, 25, 20, 15, 10] },
      60: { dl: [], ul: [30, 25, 20, 15, 10] },
    },
    81: {
      15: { dl: [], ul: [20, 15, 10, 5] },
      30: { dl: [], ul: [20, 15, 10] },
    },
    82: {
      15: { dl: [], ul: [20, 15, 10, 5] },
      30: { dl: [], ul: [20, 15, 10] },
    },
    83: {
      15: { dl: [], ul: [20, 15, 10, 5] },
      30: { dl: [], ul: [20, 15, 10] },
    },
    84: {
      15: { dl: [], ul: [20, 15, 10, 5] },
      30: { dl: [], ul: [20, 15, 10] },
      60: { dl: [], ul: [20, 15, 10] },
    },
    86: {
      15: { dl: [], ul: [40, 20, 15, 10, 5] },
      30: { dl: [], ul: [40, 20, 15, 10] },
      60: { dl: [], ul: [40, 20, 15, 10] },
    },
    257: {
      60: { dl: [200, 100, 50], ul: [200, 100, 50] },
      120: { dl: [200, 100, 50], ul: [200, 100, 50] },
    },
    258: {
      60: { dl: [200, 100, 50], ul: [200, 100, 50] },
      120: { dl: [200, 100, 50], ul: [200, 100, 50] },
    },
    260: {
      60: { dl: [200, 100, 50], ul: [200, 100, 50] },
      120: { dl: [200, 100, 50], ul: [200, 100, 50] },
    },
    261: {
      60: { dl: [200, 100, 50], ul: [200, 100, 50] },
      120: { dl: [200, 100, 50], ul: [200, 100, 50] },
    },
  };

  const bandEntry = tables[band];
  if (!bandEntry) return { dl: [], ul: [] };
  const scsEntry = bandEntry[scs];
  return scsEntry ?? { dl: [], ul: [] };
}

/**
 * Parse NR channel bandwidths for a single band entry.
 * Mirrors `parseNRChannelBWs` in the upstream Kotlin.
 *
 * @param bandEntry  - the raw JSON object for this band from supportedBandListNR
 * @param band       - the band number
 * @param scs60Fr1   - whether scs-60kHz is supported in phy-ParametersFR1
 * @param isEmbb     - whether this is an EMBB UE (true by default for NR NSG logs)
 */
export function parseNrBandwidths(
  bandEntry: Record<string, unknown>,
  band: number,
  scs60Fr1: boolean,
  isEmbb: boolean,
): BwsNr[] {
  const channelBWsDL = getObject(bandEntry, 'channelBWs-DL');
  const channelBWsUL = getObject(bandEntry, 'channelBWs-UL');
  const channelBWsDlV1590 = getObject(bandEntry, 'channelBWs-DL-v1590');
  const channelBWsUlV1590 = getObject(bandEntry, 'channelBWs-UL-v1590');

  // Parse the main channel BWs
  const bandwidthsDL = parseNrBwObject(channelBWsDL, band, false, isEmbb);
  const bandwidthsUL = parseNrBwObject(channelBWsUL, band, false, isEmbb);

  // Determine the SCS range for this band
  const scsRange = isFR2(band)
    ? [60, 120]
    : scs60Fr1
      ? [15, 30, 60]
      : [15, 30];

  // Fill missing SCS entries from the default table (TS 38.306 §4.2.7.6)
  for (const scs of scsRange) {
    if (!bandwidthsDL.has(scs)) {
      bandwidthsDL.set(scs, getDefaultBws(band, scs).dl);
    }
    if (!bandwidthsUL.has(scs)) {
      bandwidthsUL.set(scs, getDefaultBws(band, scs).ul);
    }
  }

  // Merge v1590 extension entries: concatenate arrays for the same scs key.
  // Mirrors Kotlin: this[key] = this[key]?.plus(value) ?: value
  const v1590dl = parseNrBwObject(channelBWsDlV1590, band, true, isEmbb);
  const v1590ul = parseNrBwObject(channelBWsUlV1590, band, true, isEmbb);
  for (const [scs, bws] of v1590dl) {
    const existing = bandwidthsDL.get(scs);
    bandwidthsDL.set(scs, existing !== undefined ? [...existing, ...bws] : bws);
  }
  for (const [scs, bws] of v1590ul) {
    const existing = bandwidthsUL.get(scs);
    bandwidthsUL.set(scs, existing !== undefined ? [...existing, ...bws] : bws);
  }

  // Build the BwsNr list, sorting each array descending
  const bwsList: BwsNr[] = [];
  for (const scs of scsRange) {
    let dlBws = bandwidthsDL.get(scs) ?? [];
    let ulBws = bandwidthsUL.get(scs) ?? [];

    // Skip if both are empty
    if (dlBws.length === 0 && ulBws.length === 0) continue;

    // If DL and UL are equal, share the same sorted array
    const dlSorted = [...dlBws].sort((a, b) => b - a);
    const ulSorted = [...ulBws].sort((a, b) => b - a);

    const dlArr: number[] = dlSorted;
    const ulArr: number[] = dlSorted.join(',') === ulSorted.join(',') ? dlSorted : ulSorted;

    bwsList.push({ scs, bandwidthsDl: dlArr, bandwidthsUl: ulArr });
  }

  return bwsList;
}

// ---------------------------------------------------------------------------
// getNrBands: port of upstream `getNrBands(nrCapability, ueType)`
// ---------------------------------------------------------------------------

/**
 * Determine if this NR capability is a RedCap UE.
 * Non-RedCap UEs use EMBB paths (default 100 MHz for certain bands).
 */
function isRedCap(nr: Record<string, unknown>): boolean {
  // nrCapabilityV1700 = nrCapability.nonCriticalExtension (chain varies)
  // redCapParameters-r17.supportOfRedCap-r17
  // For simplicity, walk NCE chain until we find redCapParameters-r17
  // The upstream walks UENrCapabilityJson.nrRrcCapabilityV1700
  const nce = nceChain(nr, 1, 'nonCriticalExtension');
  if (!nce) return false;
  const redCap = getObject(nce, 'redCapParameters-r17');
  return redCap ? getString(redCap, 'supportOfRedCap-r17') !== undefined : false;
}

/**
 * Extract NR bands from the NR capability container.
 * Mirrors `getNrBands(nrCapability, ueType)` in the upstream.
 *
 * Note: mimoDl/mimoUl enrichment from feature sets is done in Task 5
 * (getNrBandCombinations / linkFeaturesAndCarrier).
 */
export function getNrBands(nr: Record<string, unknown>): BandNrDetails[] {
  const phyParamsFr1 = getObject(getObject(nr, 'phy-Parameters'), 'phy-ParametersFR1');
  // qam256Fr1DL: phy-Parameters.phy-ParametersFR1.pdsch-256QAM-FR1 present
  const qam256Fr1DL = phyParamsFr1 ? getString(phyParamsFr1, 'pdsch-256QAM-FR1') !== undefined : false;
  // scs60Fr1: phy-Parameters.phy-ParametersFR1.scs-60kHz present
  const scs60Fr1 = phyParamsFr1 ? getString(phyParamsFr1, 'scs-60kHz') !== undefined : false;

  const isEmbb = !isRedCap(nr);

  const supportedBandListNR = getArrayAtPath(nr, 'rf-Parameters.supportedBandListNR');
  if (!supportedBandListNR) return [];

  const result: BandNrDetails[] = [];

  for (const item of supportedBandListNR) {
    const band = getInt(item, 'bandNR');
    if (band === undefined) continue;

    const fr2 = isFR2(band);
    const isSul = NR_SUL_BANDS.has(band);

    // Determine DL modulation
    // qam1024: FR1 only, pdsch-1024QAM-FR1-r17
    const qam1024Dl = !fr2 && getString(item, 'pdsch-1024QAM-FR1-r17') !== undefined;
    // qam256: FR1 uses global phyParamsFr1 flag; FR2 uses per-band pdsch-256QAM-FR2
    const qam256Dl = fr2
      ? getString(item, 'pdsch-256QAM-FR2') !== undefined
      : qam256Fr1DL;

    let modDL: Modulation;
    if (qam1024Dl) {
      modDL = MOD_QAM1024;
    } else if (qam256Dl) {
      modDL = MOD_QAM256;
    } else {
      modDL = MOD_QAM64;
    }

    // Determine UL modulation (pusch-256QAM present → QAM256, else QAM64; SDL has none)
    let modUL: Modulation | undefined;
    if (getString(item, 'pusch-256QAM') !== undefined) {
      modUL = MOD_QAM256;
    } else {
      // Default QAM64 for UL (non-SDL)
      modUL = MOD_QAM64;
    }

    // Power class
    let powerClass: PowerClass | undefined;
    if (getString(item, 'ue-PowerClass-v1610') !== undefined) {
      powerClass = PC1dot5;
    } else {
      const pcStr = getString(item, 'ue-PowerClass');
      if (pcStr !== undefined) {
        // upstream: PowerClass.valueOf(pcStr.uppercase())
        // e.g. "pc3" → "PC3" in Kotlin enum, maps to "pc3" in our string literal
        powerClass = pcStr as PowerClass;
      } else {
        powerClass = PC3; // default
      }
    }

    // maxUplinkDutyCycle (not in oracle for this fixture; include if present)
    let maxUplinkDutyCycle: number | undefined;
    let dutyCycleKey: string | undefined;
    if (fr2) {
      dutyCycleKey = 'maxUplinkDutyCycle-FR2';
    } else if (powerClass === PC2) {
      maxUplinkDutyCycle = 50; // TS 38.306 default
      dutyCycleKey = 'maxUplinkDutyCycle-PC2-FR1';
    } else if (powerClass === PC1dot5) {
      dutyCycleKey = 'maxUplinkDutyCycle-PC1dot5-MPE-FR1-r16';
    }
    if (dutyCycleKey) {
      const dcStr = getString(item, dutyCycleKey);
      if (dcStr !== undefined) {
        const dcVal = parseInt(dcStr.replace('n', ''), 10);
        if (!isNaN(dcVal)) maxUplinkDutyCycle = dcVal;
      }
    }

    // rateMatchingLteCrs
    const rateMatchingLteCrs = getString(item, 'rateMatchingLTE-CRS') !== undefined;

    // Bandwidths
    const bandwidths = parseNrBandwidths(
      item as Record<string, unknown>,
      band,
      scs60Fr1,
      isEmbb,
    );

    const bandDetails: BandNrDetails = { band };
    if (!isSul) bandDetails.modulationDl = modDL;
    if (modUL) bandDetails.modulationUl = modUL;
    if (powerClass !== undefined && powerClass !== PC_NONE) bandDetails.powerClass = powerClass;
    if (maxUplinkDutyCycle !== undefined && maxUplinkDutyCycle !== 0) {
      bandDetails.maxUplinkDutyCycle = maxUplinkDutyCycle;
    }
    if (rateMatchingLteCrs) bandDetails.rateMatchingLteCrs = true;
    if (bandwidths.length > 0) bandDetails.bandwidths = bandwidths;

    result.push(bandDetails);
  }

  return result;
}

// ---------------------------------------------------------------------------
// getNrNsaBandsEutra: port of upstream `getNrBands(eutraCapability, endc=true)`
// ---------------------------------------------------------------------------

/**
 * Resolve the v1510 extension from the eutra container.
 *
 * Version chain (mirroring UEEutraCapabilityJson.kt):
 *   v1460 = nceChain(eutra, 2, 'lateNonCriticalExtension', 3, then many NCE)
 *
 * From lte-bands.ts we know v1460 is returned by resolveVersions. Rather than
 * importing the full resolveVersions function, we walk the chain inline since
 * we only need v1510.
 *
 * The chain from eutra root to v1510:
 *   nce×2 → lateNonCriticalExtension → nce×3  (= v9e0 base)
 *   then nce×3                                  (= v1020)
 *   then nce×8                                  (= v1350)
 *   then nce×2                                  (= v1430)
 *   then nce×2                                  (= v1450)
 *   then nce×1                                  (= v1460)
 *   then nce×1                                  (= v1510)
 */
function resolveV1510(eutra: Record<string, unknown>): Record<string, unknown> | undefined {
  // v1020 = nce(eutra, 3)
  const v1020 = nceChain(eutra, 3);
  if (!v1020) return undefined;
  // v1060..v1350: 15 NCEs from v1020 (v1060×1, v1090×1, v1170×2, v1180×1,
  //   v11a0×1, v1250×1, v1260×1, v1270×1, v1280×1, v1310×1, v1320×1,
  //   v1330×1, v1340×1, v1350×1 = 15 total)
  const v1350 = nceChain(v1020, 15);
  if (!v1350) return undefined;
  // v1430 = nce(v1350, 2)
  const v1430 = nceChain(v1350, 2);
  if (!v1430) return undefined;
  // v1450 = nce(v1430, 2)
  const v1450 = nceChain(v1430, 2);
  if (!v1450) return undefined;
  // v1460 = nce(v1450, 1)
  const v1460 = nceChain(v1450, 1);
  if (!v1460) return undefined;
  // v1510 = nce(v1460, 1)
  return nceChain(v1460, 1);
}

/**
 * Extract NR-NSA band numbers from the eutra container.
 * Mirrors `getNrBands(eutraCapability, endc=true)` in the upstream.
 *
 * Uses `eutraCapabilityV1510.irat-ParametersNR-r15.supportedBandListEN-DC-r15`
 * and extracts `bandNR-r15`.
 *
 * The list is sorted ascending (upstream calls .sorted() on BandBoxed).
 */
export function getNrNsaBandsEutra(eutra: Record<string, unknown>): BandBoxed[] {
  const v1510 = resolveV1510(eutra);
  if (!v1510) return [];

  const supportedBandListNR = getArrayAtPath(
    v1510,
    'irat-ParametersNR-r15.supportedBandListEN-DC-r15',
  );
  if (!supportedBandListNR) return [];

  const bands: BandBoxed[] = supportedBandListNR
    .map((item) => {
      const band = getInt(item, 'bandNR-r15');
      return band !== undefined ? { band } : undefined;
    })
    .filter((b): b is BandBoxed => b !== undefined);

  // upstream sorts BandBoxed list
  return bands.sort((a, b) => a.band - b.band);
}
