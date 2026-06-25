/**
 * Error-handling tests (Task 5 — spec §9).
 *
 * Covers:
 *  - empty / whitespace input → error message
 *  - unrecognized / non-NSG text → error message
 *  - oversized input (> 8 MB) → oversized error message (without crashing)
 *  - bad fragment hash → distinct decode-error message surfaced by loadFromFragment
 *
 * All failure paths are NON-FATAL: no exception escapes, `caps` is always an
 * array (possibly empty), and the UI can always keep the textarea editable.
 */

import { describe, it, expect } from 'vitest';
import { parseInput } from '../../src/lib/parse-input';
import { loadFromFragmentWithError } from '../../src/lib/fragment-state';
import { readFixtureText } from '../parser/harness';

// ── parseInput error taxonomy ─────────────────────────────────────────────────

describe('parseInput — error taxonomy', () => {
  it('empty string → caps:[] with an error message', () => {
    const result = parseInput('');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it('whitespace-only → caps:[] with an error message', () => {
    const result = parseInput('   \n\t  ');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
  });

  it('garbage text → caps:[] with an unrecognized-text error', () => {
    const result = parseInput('garbage that is not NSG');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it('short random string → caps:[] with an error', () => {
    const result = parseInput('hello world');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
  });

  it('oversized input → caps:[] with the oversized-input message (no crash)', () => {
    // > 8 MB to trigger the guard before parsing
    const bigText = 'x'.repeat(8_100_000);
    const result = parseInput(bigText);
    expect(result.caps).toEqual([]);
    expect(result.error).toMatch(/too large/i);
  });

  it('valid nsgNr fixture → caps:[oneItem] with no error', () => {
    const text = readFixtureText('nsgNr.input.txt');
    const result = parseInput(text);

    expect(result.caps).toHaveLength(1);
    expect(result.error).toBeUndefined();

    const caps = result.caps[0]!;
    expect(caps.nrBands?.length).toBeGreaterThan(0);
    expect(caps.nrca?.length).toBeGreaterThan(0);
  });
});

// ── loadFromFragment — bad-fragment path ─────────────────────────────────────

describe('loadFromFragmentWithError — bad-fragment path', () => {
  it('empty hash → { text: null, decodeError: null }', async () => {
    const r = await loadFromFragmentWithError('');
    expect(r.text).toBeNull();
    expect(r.decodeError).toBeNull();
  });

  it('hash with no d= key → { text: null, decodeError: null }', async () => {
    const r = await loadFromFragmentWithError('#nope');
    expect(r.text).toBeNull();
    expect(r.decodeError).toBeNull();
  });

  it('garbage d= payload → { text: null, decodeError: <message> }', async () => {
    const r = await loadFromFragmentWithError('#d=NOTVALIDPAYLOAD!!!!');
    expect(r.text).toBeNull();
    expect(typeof r.decodeError).toBe('string');
    expect(r.decodeError!.length).toBeGreaterThan(0);
  });

  it('valid round-trip → { text: originalText, decodeError: null }', async () => {
    const { encodeState } = await import('../../src/codec');
    const original = 'rat-Type : nr\n';
    const payload = await encodeState(original);
    const r = await loadFromFragmentWithError(`#d=${payload}`);
    expect(r.text).toBe(original);
    expect(r.decodeError).toBeNull();
  });
});
