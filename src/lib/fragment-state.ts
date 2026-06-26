import { parseFragment, decodeState, encodeState, toFragment } from '~/codec';
import type { Capture } from '~/lib/multi-capture';

/**
 * Load the original NSG text from a URL hash fragment.
 *
 * @param hash - The full hash string (e.g. `#d=…`) or empty string.
 * @returns The decoded NSG text, or `null` if the hash is absent, invalid, or
 *   the payload cannot be decoded.
 *
 * Safe to call in Node/SSR with an empty string — returns `null` without
 * accessing any browser globals.
 */
export async function loadFromFragment(hash: string): Promise<string | null> {
  const payload = parseFragment(hash);
  if (!payload) return null;
  try {
    return await decodeState(payload);
  } catch {
    return null;
  }
}

/**
 * Result from loadFromFragmentWithError — distinguishes "no fragment" from
 * "bad fragment" so the route can surface a distinct decode-error message.
 *
 *  - No `d=` key in hash → `{ text: null, decodeError: null }`
 *  - `d=` present but decode fails → `{ text: null, decodeError: <message> }`
 *  - `d=` present and decoded → `{ text: <text>, decodeError: null }`
 */
export interface FragmentResult {
  text: string | null;
  decodeError: string | null;
}

/**
 * Like loadFromFragment but distinguishes "no fragment" from "bad fragment".
 *
 * Safe to call in Node/SSR with an empty string.
 */
export async function loadFromFragmentWithError(hash: string): Promise<FragmentResult> {
  const payload = parseFragment(hash);
  if (!payload) {
    // No `d=` key at all — not a shared link
    return { text: null, decodeError: null };
  }
  try {
    const text = await decodeState(payload);
    return { text, decodeError: null };
  } catch {
    return {
      text: null,
      decodeError: 'This share link is corrupted or unsupported.',
    };
  }
}

/**
 * Encode `text` and update the URL fragment via `history.replaceState`.
 *
 * MUST only be called from client-side code (e.g. an `onClick$` handler or
 * `useVisibleTask$`). `history` is a browser global — it does not exist during
 * Qwik's static prerender.
 */
export async function writeFragment(text: string): Promise<void> {
  const payload = await encodeState(text);
  history.replaceState(null, '', toFragment(payload));
}

/** Narrow an unknown decoded value to the captures-array shape. */
function isCaptureArray(value: unknown): value is Capture[] {
  return (
    Array.isArray(value) &&
    value.every((e) => {
      const o = e as Record<string, unknown> | null;
      return o != null && typeof o.text === 'string' && typeof o.name === 'string';
    })
  );
}

/**
 * Encode the capture array as one string through the existing codec and update
 * the URL fragment via `history.replaceState`. Client-only (browser global
 * `history`) — call from `onClick$`/`useVisibleTask$`, never during prerender.
 */
export async function writeFragmentCaptures(captures: Capture[]): Promise<void> {
  const payload = await encodeState(JSON.stringify(captures));
  history.replaceState(null, '', toFragment(payload));
}

export interface CapturesFragmentResult {
  /** decoded captures, or null when there is no fragment / it is corrupt */
  captures: Capture[] | null;
  /** non-null only when a present fragment failed to decode */
  decodeError: string | null;
}

/**
 * Decode the URL fragment into capture cards. A legacy single-blob link (raw
 * NSG text, not JSON) decodes as one unnamed capture, so old share links keep
 * working. Safe to call in Node/SSR with an empty string.
 */
export async function loadCapturesFromFragment(hash: string): Promise<CapturesFragmentResult> {
  const payload = parseFragment(hash);
  if (!payload) {
    return { captures: null, decodeError: null };
  }
  let decoded: string;
  try {
    decoded = await decodeState(payload);
  } catch {
    return { captures: null, decodeError: 'This share link is corrupted or unsupported.' };
  }
  try {
    const value: unknown = JSON.parse(decoded);
    if (isCaptureArray(value)) {
      // Normalize to exactly { name, text } (drop any extra keys).
      return {
        captures: value.map((e) => ({ name: e.name, text: e.text })),
        decodeError: null,
      };
    }
  } catch {
    // Not JSON → legacy raw NSG text. Fall through to the single-capture wrap.
  }
  return { captures: [{ name: '', text: decoded }], decodeError: null };
}
