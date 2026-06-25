import { describe, it, expect } from 'vitest';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';

describe('canonical parity: nsgEutra', () => {
  it('matches oracleUeLog/nsgEutra.json', () => {
    const actual = nsgTextToCanonical(readFixtureText('nsgEutra.input.txt'));
    const expected = readFixtureJson('nsgEutra.ueLog.json');
    expect(normalizeVolatile(actual)).toEqual(normalizeVolatile(expected));
  });
});
