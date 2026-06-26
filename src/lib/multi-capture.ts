import type { Capabilities } from '~/parser/types/uecapabilityparser';
import { parseInput } from '~/lib/parse-input';

/** One input card: a user-entered label (may be '') and the pasted NSG text. */
export interface Capture {
  name: string;
  text: string;
}

/** Per-card parse outcome, 1:1 with the input cards, in input order. */
export interface CardParse {
  /** text was empty/whitespace → skipped, not an error */
  blank: boolean;
  /** present iff this card produced a device */
  caps?: Capabilities;
  /** present iff a non-blank card failed to parse */
  error?: string;
  /** non-fatal warnings for this card ([] if none) */
  warnings: string[];
}

/** Result of collecting all cards. `devices`/`labels` are the successful subset, aligned. */
export interface MultiParse {
  /** 1:1 with the input captures (drives per-card UI) */
  cards: CardParse[];
  /** successful devices, in input order (→ MultiCapabilityView.capabilitiesList) */
  devices: Capabilities[];
  /** labels aligned with `devices` (→ MultiCapabilityView.labels) */
  labels: string[];
  /** true iff every card was blank (→ empty-state message) */
  allBlank: boolean;
}

/**
 * Run each non-blank capture through the existing `parseInput` and collect the
 * successes. Pure — no browser globals, no network. `parseInput` is untouched.
 */
export function collectCaptures(captures: Capture[]): MultiParse {
  const cards: CardParse[] = [];
  const devices: Capabilities[] = [];
  const labels: string[] = [];

  for (const capture of captures) {
    if (capture.text.trim() === '') {
      cards.push({ blank: true, warnings: [] });
      continue;
    }
    const result = parseInput(capture.text);
    const warnings = result.warnings ?? [];
    if (result.caps.length === 1) {
      const caps = result.caps[0]!;
      cards.push({ blank: false, caps, warnings });
      devices.push(caps);
      const name = capture.name.trim();
      // Number by device position so a failed/blank card leaves no gap.
      labels.push(name !== '' ? name : `Capture ${devices.length}`);
    } else {
      cards.push({ blank: false, error: result.error, warnings });
    }
  }

  return { cards, devices, labels, allBlank: cards.every((c) => c.blank) };
}
