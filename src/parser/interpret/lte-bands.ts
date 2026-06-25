/**
 * LTE band list + LTE category interpretation.
 * Ported from upstream `getLteBands` and `getLTECategory` in
 * ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser).
 *
 * The canonical `eutra` object has the same field names as the upstream
 * `UEEutraCapabilityJson` root, with the versioned extension objects reachable
 * via `nonCriticalExtension` chains identical to those in
 * `UEEutraCapabilityJson.kt`.
 */

import type { BandLteDetails, Mimo, Modulation, ModulationOrder, PowerClass } from '../types/uecapabilityparser';
import {
  getObject,
  getInt,
  getString,
  getArrayAtPath,
} from '../json';
import { nceChain } from './versions';

// ---------------------------------------------------------------------------
// Static Mimo / Modulation sentinel values for defaults set in getLteBands.
// The .d.ts Mimo.Type / Modulation.Type are ambient enums — members are
// runtime-undefined, so we cast via the union discriminant type.
// ---------------------------------------------------------------------------
type MimoType = Mimo['type'];
type ModType = Modulation['type'];

const MIMO_2: Mimo = { type: 'single' as MimoType, value: 2 } as Mimo.single;
const MIMO_1: Mimo = { type: 'single' as MimoType, value: 1 } as Mimo.single;
const MOD_QAM64: Modulation = { type: 'single' as ModType, value: 'qam64' as ModulationOrder } as Modulation.single;
const MOD_QAM256: Modulation = { type: 'single' as ModType, value: 'qam256' as ModulationOrder } as Modulation.single;
const MOD_QAM16: Modulation = { type: 'single' as ModType, value: 'qam16' as ModulationOrder } as Modulation.single;

// ---------------------------------------------------------------------------
// SDL LTE bands (DL-only, no UL) — from DuplexBandTable.kt (3GPP 36.101).
// These bands get powerClass=none and mimoUl=0.
// ---------------------------------------------------------------------------
const LTE_SDL_BANDS = new Set([29, 32, 67, 69, 75, 76]);

function isLteSdl(band: number): boolean {
  return LTE_SDL_BANDS.has(band);
}

/**
 * Resolve the versioned extension objects from the eutra root.
 * Mirrors the property assignments in UEEutraCapabilityJson.kt.
 */
function resolveVersions(eutra: Record<string, unknown>) {
  // eutraCapabilityV9e0:
  //   rootJson.getObjectAtPath("nonCriticalExtension.".repeat(2) +
  //     "lateNonCriticalExtension" + ".nonCriticalExtension".repeat(3))
  // = NCE × 2, then lateNonCriticalExtension, then NCE × 3
  const v9e0 = nceChain(eutra, 2, 'lateNonCriticalExtension', 3);

  // eutraCapabilityV1020:
  //   rootJson.getObjectAtPath("nonCriticalExtension".repeat(3, "."))  → 3 NCEs
  const v1020 = nceChain(eutra, 3);

  // eutraCapabilityV1060 = v1020?.getObject("nonCriticalExtension")
  const v1060 = v1020 ? getObject(v1020, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1090 = v1060?.getObject("nonCriticalExtension")
  const v1090 = v1060 ? getObject(v1060, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1170 = v1090?.getObjectAtPath("nonCriticalExtension.nonCriticalExtension")
  const v1170 = v1090 ? nceChain(v1090, 2) : undefined;

  // eutraCapabilityV1180 = v1170?.getObject("nonCriticalExtension")
  const v1180 = v1170 ? getObject(v1170, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV11a0 = v1180?.getObject("nonCriticalExtension")
  const v11a0 = v1180 ? getObject(v1180, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1250 = v11a0?.getObject("nonCriticalExtension")
  const v1250 = v11a0 ? getObject(v11a0, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1260 = v1250?.getObject("nonCriticalExtension")
  const v1260 = v1250 ? getObject(v1250, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1270 = v1260?.getObject("nonCriticalExtension")
  const v1270 = v1260 ? getObject(v1260, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1280 = v1270?.getObject("nonCriticalExtension")
  const v1280 = v1270 ? getObject(v1270, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1310 = v1280?.getObjectAtPath("nonCriticalExtension")
  const v1310 = v1280 ? getObject(v1280, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1320 = v1310?.getObject("nonCriticalExtension")
  const v1320 = v1310 ? getObject(v1310, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1330 = v1320?.getObject("nonCriticalExtension")
  const v1330 = v1320 ? getObject(v1320, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1340 = v1330?.getObject("nonCriticalExtension")
  const v1340 = v1330 ? getObject(v1330, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1350 = v1340?.getObject("nonCriticalExtension")
  const v1350 = v1340 ? getObject(v1340, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1430 = v1350?.getObjectAtPath("nonCriticalExtension.nonCriticalExtension")
  const v1430 = v1350 ? nceChain(v1350, 2) : undefined;

  // eutraCapabilityV1450 = v1430?.getObjectAtPath("nonCriticalExtension.nonCriticalExtension")
  const v1450 = v1430 ? nceChain(v1430, 2) : undefined;

  // eutraCapabilityV1460 = v1450?.getObject("nonCriticalExtension")
  const v1460 = v1450 ? getObject(v1450, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1510 = v1460?.getObject("nonCriticalExtension")
  const v1510 = v1460 ? getObject(v1460, 'nonCriticalExtension') : undefined;

  // eutraCapabilityV1530 = v1510?.getObjectAtPath("nonCriticalExtension.nonCriticalExtension")
  const v1530 = v1510 ? nceChain(v1510, 2) : undefined;

  return {
    v9e0,
    v1020,
    v1170,
    v11a0,
    v1250,
    v1260,
    v1310,
    v1320,
    v1330,
    v1340,
    v1350,
    v1430,
    v1450,
    v1460,
    v1530,
  };
}

// ---------------------------------------------------------------------------
// getLTECategory — port of getLTECategory in ImportCapabilityInformation.kt
// ---------------------------------------------------------------------------
export function getLteCategory(eutra: Record<string, unknown>): {
  dl?: number;
  ul?: number;
} {
  const v = resolveVersions(eutra);

  let dlCategory = 0;
  let ulCategory = 0;

  // ue-Category (base)
  const base = getInt(eutra, 'ue-Category');
  if (base !== undefined) {
    dlCategory = base;
    ulCategory = base;
  }

  // ue-Category-v1020
  const cat1020 = v.v1020 ? getInt(v.v1020, 'ue-Category-v1020') : undefined;
  if (cat1020 !== undefined) {
    dlCategory = cat1020;
    ulCategory = cat1020;
  }

  // ue-Category-v1170
  const cat1170 = v.v1170 ? getInt(v.v1170, 'ue-Category-v1170') : undefined;
  if (cat1170 !== undefined) {
    dlCategory = cat1170;
    ulCategory = cat1170;
  }

  // ue-Category-v11a0
  const cat11a0 = v.v11a0 ? getInt(v.v11a0, 'ue-Category-v11a0') : undefined;
  if (cat11a0 !== undefined) {
    dlCategory = cat11a0;
    ulCategory = cat11a0;
  }

  // ue-Category-v1250: ue-CategoryDL-r12 / ue-CategoryUL-r12
  if (v.v1250) {
    const dlr12 = getInt(v.v1250, 'ue-CategoryDL-r12');
    if (dlr12 !== undefined) dlCategory = dlr12;
    const ulr12 = getInt(v.v1250, 'ue-CategoryUL-r12');
    if (ulr12 !== undefined) ulCategory = ulr12;
  }

  // ue-Category-v1260: ue-CategoryDL-v1260
  if (v.v1260) {
    const dl1260 = getInt(v.v1260, 'ue-CategoryDL-v1260');
    if (dl1260 !== undefined) dlCategory = dl1260;
  }

  // ue-Category-v1310: ue-CategoryDL-v1310 / ue-CategoryUL-v1310 (strings like "n17", "m1")
  if (v.v1310) {
    const dl1310 = getString(v.v1310, 'ue-CategoryDL-v1310');
    if (dl1310 !== undefined) dlCategory = parseInt(dl1310.slice(1), 10);
    const ul1310 = getString(v.v1310, 'ue-CategoryUL-v1310');
    if (ul1310 !== undefined) ulCategory = parseInt(ul1310.slice(1), 10);
  }

  // ue-Category-v1330: ue-CategoryDL-v1330
  if (v.v1330) {
    const dl1330 = getInt(v.v1330, 'ue-CategoryDL-v1330');
    if (dl1330 !== undefined) dlCategory = dl1330;
  }

  // ue-Category-v1340: ue-CategoryUL-v1340
  if (v.v1340) {
    const ul1340 = getInt(v.v1340, 'ue-CategoryUL-v1340');
    if (ul1340 !== undefined) ulCategory = ul1340;
  }

  // ue-Category-v1350: ue-CategoryDL-v1350 / ue-CategoryUL-v1350
  if (v.v1350) {
    const dl1350 = getInt(v.v1350, 'ue-CategoryDL-v1350');
    if (dl1350 !== undefined) dlCategory = dl1350;
    const ul1350 = getInt(v.v1350, 'ue-CategoryUL-v1350');
    if (ul1350 !== undefined) ulCategory = ul1350;
  }

  // ue-Category-v1430: ue-CategoryDL-v1430 / ue-CategoryUL-v1430 / ue-CategoryUL-v1430b (strings)
  if (v.v1430) {
    const dl1430 = getString(v.v1430, 'ue-CategoryDL-v1430');
    if (dl1430 !== undefined) dlCategory = parseInt(dl1430.slice(1), 10);
    const ul1430 = getString(v.v1430, 'ue-CategoryUL-v1430');
    if (ul1430 !== undefined) ulCategory = parseInt(ul1430.slice(1), 10);
    const ul1430b = getString(v.v1430, 'ue-CategoryUL-v1430b');
    if (ul1430b !== undefined) ulCategory = parseInt(ul1430b.slice(1), 10);
  }

  // ue-Category-v1450: ue-CategoryDL-v1450
  if (v.v1450) {
    const dl1450 = getInt(v.v1450, 'ue-CategoryDL-v1450');
    if (dl1450 !== undefined) dlCategory = dl1450;
  }

  // ue-Category-v1460: ue-CategoryDL-v1460
  if (v.v1460) {
    const dl1460 = getInt(v.v1460, 'ue-CategoryDL-v1460');
    if (dl1460 !== undefined) dlCategory = dl1460;
  }

  // ue-Category-v1530: ue-CategoryDL-v1530 / ue-CategoryUL-v1530
  if (v.v1530) {
    const dl1530 = getInt(v.v1530, 'ue-CategoryDL-v1530');
    if (dl1530 !== undefined) dlCategory = dl1530;
    const ul1530 = getInt(v.v1530, 'ue-CategoryUL-v1530');
    if (ul1530 !== undefined) ulCategory = ul1530;
  }

  return {
    dl: dlCategory !== 0 ? dlCategory : undefined,
    ul: ulCategory !== 0 ? ulCategory : undefined,
  };
}

// ---------------------------------------------------------------------------
// getLteBands — port of getLteBands in ImportCapabilityInformation.kt
// ---------------------------------------------------------------------------

interface MutableBandLteDetails {
  band: number;
  powerClass: PowerClass | undefined;
  mimoDl: Mimo;
  mimoUl: Mimo | undefined; // undefined for SDL bands
  modulationDl: Modulation;
  modulationUl: Modulation;
}

export function getLteBands(eutra: Record<string, unknown>): BandLteDetails[] {
  const v = resolveVersions(eutra);

  const supportedBandListEutra = getArrayAtPath(
    eutra,
    'rf-Parameters.supportedBandListEUTRA',
  );
  if (!supportedBandListEutra) return [];

  // Build mutable list with defaults matching upstream getLteBands:
  //   mimoDL = 2.toMimo(), modDL = QAM64, modUL = QAM16 (or NONE for SDL)
  const lteBands: MutableBandLteDetails[] = supportedBandListEutra
    .map((item) => {
      const band = getInt(item, 'bandEUTRA');
      if (band === undefined) return undefined;
      const sdl = isLteSdl(band);
      const powerClass: PowerClass | undefined = sdl ? undefined : ('pc3' as PowerClass);
      return {
        band,
        powerClass,
        mimoDl: MIMO_2,
        mimoUl: sdl ? undefined : MIMO_1,
        modulationDl: MOD_QAM64,
        modulationUl: sdl ? ({ type: 'empty' as ModType } as Modulation.empty) : MOD_QAM16,
      };
    })
    .filter((b): b is MutableBandLteDetails => b !== undefined);

  // v9e0: override band numbers
  const v9e0BandList = v.v9e0
    ? getArrayAtPath(v.v9e0, 'rf-Parameters-v9e0.supportedBandListEUTRA-v9e0')
    : undefined;
  if (v9e0BandList) {
    v9e0BandList.forEach((item, i) => {
      const band = getInt(item, 'bandEUTRA-v9e0');
      if (band !== undefined && i < lteBands.length) {
        lteBands[i]!.band = band;
      }
    });
  }

  // v1250: dl-256QAM-r12 / ul-64QAM-r12
  const v1250BandList = v.v1250
    ? getArrayAtPath(v.v1250, 'rf-Parameters-v1250.supportedBandListEUTRA-v1250')
    : undefined;
  if (v1250BandList) {
    v1250BandList.forEach((item, i) => {
      const b = lteBands[i];
      if (!b) return;
      if (getString(item, 'dl-256QAM-r12') !== undefined) {
        b.modulationDl = MOD_QAM256;
      }
      if (getString(item, 'ul-64QAM-r12') !== undefined) {
        b.modulationUl = MOD_QAM64;
      }
    });
  }

  // v1310: ue-PowerClass-5-r13
  const v1310BandList = v.v1310
    ? getArrayAtPath(v.v1310, 'rf-Parameters-v1310.supportedBandListEUTRA-v1310')
    : undefined;
  if (v1310BandList) {
    v1310BandList.forEach((item, i) => {
      if (getString(item, 'ue-PowerClass-5-r13') !== undefined && i < lteBands.length) {
        lteBands[i]!.powerClass = 'pc5' as PowerClass;
      }
    });
  }

  // v1320: ue-PowerClass-N-r13 (e.g. "class1" → "PC1" → "pc1")
  const v1320BandList = v.v1320
    ? getArrayAtPath(v.v1320, 'rf-Parameters-v1320.supportedBandListEUTRA-v1320')
    : undefined;
  if (v1320BandList) {
    v1320BandList.forEach((item, i) => {
      const pcStr = getString(item, 'ue-PowerClass-N-r13');
      if (pcStr !== undefined && i < lteBands.length) {
        // upstream: PowerClass.valueOf(it.replace("class", "PC"))
        // "class1" → "PC1" — but our enum values are lowercase: "pc1"
        const pcValue = pcStr.replace('class', 'PC').toLowerCase() as PowerClass;
        lteBands[i]!.powerClass = pcValue;
      }
    });
  }

  // Convert to BandLteDetails (omit empty-modulation fields for SDL)
  return lteBands.map((b) => {
    const out: BandLteDetails = { band: b.band };
    out.mimoDl = b.mimoDl;
    if (b.mimoUl !== undefined) out.mimoUl = b.mimoUl;
    if (b.modulationDl.type !== 'empty') out.modulationDl = b.modulationDl;
    if (b.modulationUl.type !== 'empty') out.modulationUl = b.modulationUl;
    if (b.powerClass !== undefined) out.powerClass = b.powerClass;
    return out;
  });
}
