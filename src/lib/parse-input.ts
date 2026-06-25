import type { Capabilities } from '~/parser/types/uecapabilityparser';
import { nsgTextToCanonical } from '~/parser/canonical';
import { interpret } from '~/parser/interpret';

/**
 * Typed result from parseInput — always safe to destructure.
 *
 * `caps` is always an array (possibly empty).
 * `error` is present whenever `caps` is empty; undefined on success.
 */
export interface ParseResult {
  caps: Capabilities[];
  error?: string;
}

/** Guard limit: reject inputs larger than 8 M code units before feeding the parser. */
const MAX_INPUT_CHARS = 8_000_000;

/**
 * Parse pasted NSG UE-capability text into a typed ParseResult.
 *
 * Error taxonomy:
 *  - empty / whitespace-only → informative empty-state message
 *  - oversized (> 8 MB) → oversized-input message
 *  - parser throws → non-fatal parse-failure message
 *  - parses but has no recognised capability data → unrecognized-text message
 *  - success → { caps: [caps] } with no error
 *
 * Pure — no network, no browser globals.
 */
export function parseInput(text: string): ParseResult {
  const t = text.trim();

  if (!t) {
    return {
      caps: [],
      error: 'Paste NSG UE-capability text to begin.',
    };
  }

  if (t.length > MAX_INPUT_CHARS) {
    return {
      caps: [],
      error: 'Input is too large to parse in the browser.',
    };
  }

  let caps: Capabilities;
  try {
    caps = interpret(nsgTextToCanonical(t));
  } catch {
    return {
      caps: [],
      error: 'Failed to parse the pasted text.',
    };
  }

  // Detect "no capability data at all" — every relevant field is absent or empty.
  const hasData =
    (caps.lteBands != null && caps.lteBands.length > 0) ||
    (caps.lteca != null && caps.lteca.length > 0) ||
    (caps.nrBands != null && caps.nrBands.length > 0) ||
    (caps.nrca != null && caps.nrca.length > 0) ||
    (caps.endc != null && caps.endc.length > 0) ||
    (caps.nrNsaBandsEutra != null && caps.nrNsaBandsEutra.length > 0) ||
    (caps.nrSaBandsEutra != null && caps.nrSaBandsEutra.length > 0) ||
    (caps.nrdc != null && caps.nrdc.length > 0);

  if (!hasData) {
    return {
      caps: [],
      error:
        'Could not find UE capability information in the pasted text. Make sure you copied the full NSG UE-capability message.',
    };
  }

  return { caps: [caps] };
}
