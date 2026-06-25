import { describe, it, expect } from 'vitest';
import { readFixtureText, readFixtureJson, normalizeVolatile } from './harness';

describe('oracle harness', () => {
  it('reads a fixture input', () => {
    expect(readFixtureText('nsgNr.input.txt')).toContain('rat-Type : nr');
  });

  it('reads a fixture oracle as JSON', () => {
    const oracle = readFixtureJson('nsgNr.ueLog.json') as Record<string, unknown>;
    expect(oracle).toHaveProperty('nr');
  });

  it('strips volatile keys recursively', () => {
    const input = { a: 1, timestamp: 9, nested: { id: 'x', keep: true, list: [{ parserVersion: 'v', n: 2 }] } };
    expect(normalizeVolatile(input)).toEqual({ a: 1, nested: { keep: true, list: [{ n: 2 }] } });
  });
});
