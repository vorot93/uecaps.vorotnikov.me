import { describe, it, expect } from 'vitest';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';

describe('canonical parity: nsgMrdc', () => {
  it('produces all three RAT containers matching oracleUeLog/nsgMrdc.json', () => {
    const actual = nsgTextToCanonical(readFixtureText('nsgMrdc.input.txt'));
    expect(Object.keys(actual).sort()).toEqual(['eutra', 'eutra-nr', 'nr']);
    const expected = readFixtureJson('nsgMrdc.ueLog.json');
    expect(normalizeVolatile(actual)).toEqual(normalizeVolatile(expected));
  });
});
