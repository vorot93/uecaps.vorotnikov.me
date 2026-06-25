import type { BandLteDetails, BandNrDetails, Capabilities, LogType } from '../types/uecapabilityparser';
import { getObject } from '../json';
import { getLteCategory, getLteBands } from './lte-bands';
import { getLteCa, updateLteBandsCapabilities } from './lte-ca';
import { getNrBands, getNrNsaBandsEutra } from './nr-bands';
import { getNrFeatureSet, getLteFeatureSet, getFeatureSetCombinations } from './nr-features';
import type { NrFeatureSets, LteFeatureSets } from './nr-features';
import { getNrCa, updateNrBandsCapabilities } from './nr-ca';
import { getEnDc } from './endc';

// LogType.N = 'N' (NSG-text log type). The enum is ambient-only (.d.ts), so
// we use the string literal and cast — the type is still enforced by TypeScript.
const LOG_TYPE_N = 'N' as LogType;

export function interpret(canonical: Record<string, unknown>): Capabilities {
  const eutra = getObject(canonical, 'eutra');
  const nr = getObject(canonical, 'nr');
  const eutraNr = getObject(canonical, 'eutra-nr');

  const caps: Capabilities = {
    lteBands: [],
    lteca: [],
    logType: LOG_TYPE_N,
    metadata: {},
    parserVersion: 'stage2-ts',
    timestamp: 0,
  };

  // LTE bands map (for modulation lookup by EN-DC combo resolution)
  let lteBandsMap = new Map<number, BandLteDetails>();

  // LTE features (parsed only if mrdc/eutraNr container is present — mirrors upstream)
  let lteFeatures: LteFeatureSets | null = null;

  if (eutra) {
    const { dl: lteCategoryDl, ul: lteCategoryUl } = getLteCategory(eutra);
    caps.lteCategoryDl = lteCategoryDl;
    caps.lteCategoryUl = lteCategoryUl;

    const lteBands = getLteBands(eutra);
    const lteca = getLteCa(eutra, lteBands);
    updateLteBandsCapabilities(lteBands, lteca);

    // Upstream sorts lteBandsMap.values.sorted() — sort ascending by band number
    caps.lteBands = [...lteBands].sort((a, b) => a.band - b.band);
    caps.lteca = lteca;

    // NR-NSA bands from eutra container
    caps.nrNsaBandsEutra = getNrNsaBandsEutra(eutra);

    // Build LTE bands map for EN-DC modulation enrichment
    lteBandsMap = new Map(lteBands.map((b) => [b.band, b]));

    // Parse LTE features only if eutra-nr (MRDC) container is present
    if (eutraNr) {
      lteFeatures = getLteFeatureSet(eutra);
    }
  }

  // NR bands map and feature sets (used by both NR-CA and EN-DC paths)
  let nrBandsMap = new Map<number, BandNrDetails>();
  let nrFeatures: NrFeatureSets | null = null;

  if (nr) {
    // NR bands from the NR capability container
    const nrBandsList = getNrBands(nr);
    nrBandsMap = new Map(nrBandsList.map((b) => [b.band, b]));

    // NR feature sets and feature-set combinations
    nrFeatures = getNrFeatureSet(nr);
    const fsCombinations = getFeatureSetCombinations(nr);

    // NR-CA combos
    const nrca = getNrCa(nr, nrFeatures, fsCombinations, nrBandsMap);

    // Enrich nrBands with MIMO and 90 MHz from NR-CA combo components
    updateNrBandsCapabilities(nrBandsMap, nrca);

    if (nrca.length > 0) caps.nrca = nrca;
  }

  if (eutraNr) {
    // EN-DC combos: uses LTE features from eutra container + NR features from nr container.
    const endc = getEnDc(eutraNr, nrFeatures, lteFeatures, nrBandsMap, lteBandsMap);
    if (endc.length > 0) caps.endc = endc;

    // Upstream also calls updateNrBandsCapabilities with EN-DC combos
    // (it passes enDcCombos + nrCombos + nrDcCombos all at once)
    updateNrBandsCapabilities(nrBandsMap, endc);
  }

  // Finalize nrBands (after enrichment from both NR-CA and EN-DC combos)
  if (nr) {
    caps.nrBands = [...nrBandsMap.values()].sort((a, b) => a.band - b.band);
  }

  return caps;
}
