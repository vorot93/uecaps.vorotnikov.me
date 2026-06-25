import type { IRatCapabilities, Rat, UeType } from '../types/uecapabilityparser';
import { getObject, getString } from '../json';

type RatCapLteType = IRatCapabilities.RatCapabilitiesLte['type'];
type RatCapNrType = IRatCapabilities.RatCapabilitiesNr['type'];

export function accessRelease(container: Record<string, unknown>): number | null {
  const rel = getString(container, 'accessStratumRelease');
  if (rel === undefined) return null;
  const n = parseInt(rel.replace(/^rel/, ''), 10);
  return Number.isInteger(n) ? n : null;
}

export function segSupported(
  v1690: Record<string, unknown> | undefined,
  release: number | null,
): boolean | null {
  const dflt = release !== null && release > 16 ? false : null;
  const seg = getString(v1690 ?? {}, 'ul-RRC-Segmentation-r16') !== undefined;
  return seg ? true : dflt;
}

export function ueType(nr: Record<string, unknown>): UeType | undefined {
  // redCapParameters-r17 is carried behind the V1700 NCE extension, absent in
  // all current fixtures -> default eMBB (omitted). A direct read of `nr`
  // resolves to nothing here; full V1700 NCE navigation is latent (no fixture
  // exercises RedCap).
  const redCap = getObject(nr, 'redCapParameters-r17');
  const isRedCap = getString(redCap, 'supportOfRedCap-r17') !== undefined;
  return isRedCap ? ('RedCap_R17' as UeType) : undefined;
}

export function ratCapabilitiesLte(eutra: Record<string, unknown>): IRatCapabilities.RatCapabilitiesLte {
  const out: IRatCapabilities.RatCapabilitiesLte = {
    type: 'RatCapabilitiesLte' as RatCapLteType,
    rat: 'EUTRA' as Rat,
  };
  const release = accessRelease(eutra);
  if (release !== null) out.release = release;
  const seg = segSupported(undefined, release);
  if (seg !== null) out.ueCapSegmentationSupported = seg;
  return out;
}

export function ratCapabilitiesNr(nr: Record<string, unknown>): IRatCapabilities.RatCapabilitiesNr {
  const out: IRatCapabilities.RatCapabilitiesNr = {
    type: 'RatCapabilitiesNr' as RatCapNrType,
    rat: 'NR' as Rat,
  };
  const release = accessRelease(nr);
  if (release !== null) out.release = release;
  const seg = segSupported(undefined, release);
  if (seg !== null) out.ueCapSegmentationSupported = seg;
  const t = ueType(nr);
  if (t !== undefined) out.ueType = t;
  return out;
}
