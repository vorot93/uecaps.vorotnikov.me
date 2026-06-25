/**
 * Unit tests for parseInput — the browser-side NSG text → ParseResult bridge.
 *
 * Runs in Node env (Vitest default); only needs the parser + fixture harness.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseInput } from '../../src/lib/parse-input';
import { readFixtureText } from '../parser/harness';

describe('parseInput', () => {
  it('returns { caps:[], error } for empty string', () => {
    const result = parseInput('');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
  });

  it('returns { caps:[], error } for whitespace-only string', () => {
    const result = parseInput('   \n\t  ');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
  });

  it('returns { caps:[], error } for garbage text that is not NSG', () => {
    const result = parseInput('garbage that is not NSG');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
  });

  it('returns { caps:[], error } for a short random string', () => {
    const result = parseInput('hello world');
    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
  });

  it('returns { caps:[], oversized error } for input > 8 MB', () => {
    const bigText = 'x'.repeat(8_100_000);
    const result = parseInput(bigText);
    expect(result.caps).toEqual([]);
    expect(result.error).toMatch(/too large/i);
  });

  it('returns { caps:[caps], no error } for the nsgNr fixture', () => {
    const text = readFixtureText('nsgNr.input.txt');
    const result = parseInput(text);

    expect(result.caps).toHaveLength(1);
    expect(result.error).toBeUndefined();

    const caps = result.caps[0]!;
    expect(caps.nrBands).toBeDefined();
    expect(caps.nrBands!.length).toBeGreaterThan(0);
    expect(caps.nrca).toBeDefined();
    expect(caps.nrca!.length).toBeGreaterThan(0);
  });
});

describe('parseInput — parser-throw safety net', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { caps:[], error } when nsgTextToCanonical throws — proves the catch is exercised', async () => {
    // Force the canonical parser to throw so we exercise the catch block in
    // parseInput rather than relying on "garbage text" that happens not to throw.
    const canonicalModule = await import('../../src/parser/canonical');
    vi.spyOn(canonicalModule, 'nsgTextToCanonical').mockImplementation(() => {
      throw new Error('simulated parser failure');
    });

    // Use the nsgNr fixture text (valid input) so the empty/oversized guards
    // don't fire — only the catch block can produce the error here.
    const text = readFixtureText('nsgNr.input.txt');
    const result = parseInput(text);

    expect(result.caps).toEqual([]);
    expect(typeof result.error).toBe('string');
    // The catch returns this specific message
    expect(result.error).toMatch(/failed to parse/i);
  });
});
