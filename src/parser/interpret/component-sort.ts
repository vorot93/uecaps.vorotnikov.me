/**
 * Shared bandwidth-class comparison for component sorting (LTE-CA and EN-DC).
 * Mirrors upstream ComponentLte/ComponentNr ordering: undefined and the literal
 * 'none' both rank below any real class letter.
 */

/** Map an absent or 'none' bandwidth class to '0' (char 48 < 'A' char 65 → sorts lowest). */
export function bwClassChar(cls: string | undefined): string {
  if (cls === undefined || cls === 'none') return '0';
  return cls;
}

/** Compare two bandwidth-class values; '0'/none/undefined sort lowest. */
export function compareBwClassDesc(a: string | undefined, b: string | undefined): number {
  const av = bwClassChar(a);
  const bv = bwClassChar(b);
  if (av === bv) return 0;
  return av < bv ? -1 : 1;
}
