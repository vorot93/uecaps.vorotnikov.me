import { parseFragment, decodeState, encodeState, toFragment } from '~/codec';

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
