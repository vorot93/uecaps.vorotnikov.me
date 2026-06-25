/**
 * UE-capability filters for NR and EUTRA_NR RATs.
 * Ported from upstream `getUeNrCapabilityFilters` in
 * ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser).
 */

import type {
  IUeCapabilityFilter,
  Rat,
  BandBoxed,
  BandFilterLte,
  BandFilterNr,
  BwClass,
} from '../types/uecapabilityparser';
import { getObject, getInt, getString, getArrayAtPath, getObjectAtPath } from '../json';
import { resolveVersions } from './lte-bands';

type FilterNrType = IUeCapabilityFilter.UeCapabilityFilterNr['type'];
type FilterLteType = IUeCapabilityFilter.UeCapabilityFilterLte['type'];

/** Parse "mhz<N>" bandwidth strings → integer MHz; absent/unparseable → 0. */
function parseBw(s: string | undefined): number {
  if (s === undefined) return 0;
  const n = parseInt(s.replace(/^mhz/, ''), 10);
  return Number.isInteger(n) ? n : 0;
}

/**
 * Map a ca-BandwidthClass*-EUTRA string to BwClass when present.
 * Returns undefined when the field is absent (latent in current fixtures).
 */
function bwClass(s: string | undefined): BwClass | undefined {
  return s === undefined ? undefined : (s as BwClass);
}

/**
 * Build a UeCapabilityFilterNr from an NR or EUTRA_NR capability container.
 *
 * OMIT-DEFAULTS: only non-default / non-zero / non-false fields are included
 * so that the output deep-equals the oracle ueCapFilters entry.
 */
export function nrCapabilityFilter(
  container: Record<string, unknown>,
  rat: Rat,
): IUeCapabilityFilter.UeCapabilityFilterNr {
  const out: IUeCapabilityFilter.UeCapabilityFilterNr = {
    type: 'UeCapabilityFilterNr' as FilterNrType,
    rat,
  };

  const path =
    rat === ('EUTRA_NR' as Rat)
      ? 'rf-ParametersMRDC.appliedFreqBandListFilter'
      : 'rf-Parameters.appliedFreqBandListFilter';
  const freqBandFilter = getArrayAtPath(container, path);

  if (freqBandFilter !== undefined) {
    const lteBands: BandFilterLte[] = [];
    const nrBands: BandFilterNr[] = [];

    for (const entry of freqBandFilter) {
      const nr = getObject(entry, 'bandInformationNR');
      const eutra = getObject(entry, 'bandInformationEUTRA');

      if (nr !== undefined) {
        const band: BandFilterNr = { band: getInt(nr, 'bandNR') ?? 0 };
        const maxBwDl = parseBw(getString(nr, 'maxBandwidthRequestedDL'));
        const maxBwUl = parseBw(getString(nr, 'maxBandwidthRequestedUL'));
        const maxCCsDl = getInt(nr, 'maxCarriersRequestedDL') ?? 0;
        const maxCCsUl = getInt(nr, 'maxCarriersRequestedUL') ?? 0;
        if (maxBwDl !== 0) band.maxBwDl = maxBwDl;
        if (maxBwUl !== 0) band.maxBwUl = maxBwUl;
        if (maxCCsDl !== 0) band.maxCCsDl = maxCCsDl;
        if (maxCCsUl !== 0) band.maxCCsUl = maxCCsUl;
        nrBands.push(band);
      } else if (eutra !== undefined) {
        const band: BandFilterLte = { band: getInt(eutra, 'bandEUTRA') ?? 0 };
        const dl = bwClass(getString(eutra, 'ca-BandwidthClassDL-EUTRA'));
        const ul = bwClass(getString(eutra, 'ca-BandwidthClassUL-EUTRA'));
        if (dl !== undefined) band.bwClassDl = dl;
        if (ul !== undefined) band.bwClassUl = ul;
        lteBands.push(band);
      }
    }

    if (lteBands.length > 0) out.lteBands = lteBands;
    if (nrBands.length > 0) out.nrBands = nrBands;
  } else if (rat === ('NR' as Rat) && !out.omitEnDc && !out.includeNrDc) {
    // eutraNrOnly: set when no appliedFreqBandListFilter and no
    // supportedBandCombinationList (latent path — exercises the NR-only
    // device case in which nsgNr has a band combination list so it is false).
    const bandList = getArrayAtPath(container, 'rf-Parameters.supportedBandCombinationList');
    if (bandList === undefined) out.eutraNrOnly = true;
  }

  return out;
}

/**
 * Build a UeCapabilityFilterLte from an EUTRA capability container.
 *
 * Ported from upstream `getUeLteCapabilityFilters` in
 * ImportCapabilityInformation.kt (HandyMenny/uecapabilityparser).
 *
 * OMIT-DEFAULTS: only non-default / non-empty / non-false fields are included
 * so that the output deep-equals the oracle ueCapFilters EUTRA entry.
 *
 * NCE resolution: v1180 and v1310 are resolved via the shared `resolveVersions`
 * helper from lte-bands.ts (same mechanism used by getLteBands / getLteCategory).
 */
export function lteCapabilityFilter(eutra: Record<string, unknown>): IUeCapabilityFilter.UeCapabilityFilterLte {
  const out: IUeCapabilityFilter.UeCapabilityFilterLte = {
    type: 'UeCapabilityFilterLte' as FilterLteType,
    rat: 'EUTRA' as Rat,
  };

  const v = resolveVersions(eutra);

  // requestedBands-r11 lives at v1180.rf-Parameters-v1180.requestedBands-r11
  const requested = getArrayAtPath(v.v1180 ?? {}, 'rf-Parameters-v1180.requestedBands-r11');
  if (requested !== undefined) {
    const lteBands: BandBoxed[] = [];
    for (const b of requested) {
      if (typeof b === 'number' && Number.isInteger(b)) lteBands.push({ band: b });
    }
    if (lteBands.length > 0) out.lteBands = lteBands;
  }

  // eNB-RequestedParameters-r13 lives at v1310.rf-Parameters-v1310.eNB-RequestedParameters-r13
  const enb = getObjectAtPath(v.v1310 ?? {}, 'rf-Parameters-v1310.eNB-RequestedParameters-r13');
  if (enb !== undefined) {
    if (getString(enb, 'reducedIntNonContCombRequested-r13') !== undefined) out.reducedIntNonContComb = true;
    const ccDl = getInt(enb, 'requestedCCsDL-r13') ?? 0;
    const ccUl = getInt(enb, 'requestedCCsUL-r13') ?? 0;
    if (ccDl !== 0) out.maxCCsDl = ccDl;
    if (ccUl !== 0) out.maxCCsUl = ccUl;
    if (getString(enb, 'skipFallbackCombRequested-r13') !== undefined) out.skipFallbackCombRequested = true;
  }

  // reducedFormat: set when supportedBandCombinationReduced-r13 is present
  if (getArrayAtPath(v.v1310 ?? {}, 'rf-Parameters-v1310.supportedBandCombinationReduced-r13') !== undefined) {
    out.reducedFormat = true;
  }

  // LATENT: requestedDiffFallbackCombList-r14 → diffFallbackCombList (absent in all fixtures)
  // LATENT: appliedCapabilityFilterCommon-r15 mrdc-Request flags (absent in all fixtures)

  return out;
}
