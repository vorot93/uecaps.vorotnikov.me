import { describe, it, expect } from 'vitest';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';

describe('canonical parity: nsgNr', () => {
  it('matches oracleUeLog/nsgNr.json', () => {
    const actual = nsgTextToCanonical(readFixtureText('nsgNr.input.txt'));
    const expected = readFixtureJson('nsgNr.ueLog.json');
    expect(normalizeVolatile(actual)).toEqual(normalizeVolatile(expected));
  });
});
