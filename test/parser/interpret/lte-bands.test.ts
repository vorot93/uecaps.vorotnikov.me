import { describe, it, expect } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson } from '../harness';

const caps = interpret(nsgTextToCanonical(readFixtureText('nsgEutra.input.txt')));
const oracle = readFixtureJson('nsgEutra.caps.json') as Record<string, any>;

describe('LTE bands + category: nsgEutra', () => {
  it('lteCategoryDl/Ul match the oracle', () => {
    expect(caps.lteCategoryDl).toBe(oracle.lteCategoryDl);
    expect(caps.lteCategoryUl).toBe(oracle.lteCategoryUl);
  });
  it('the set of supported LTE band numbers matches the oracle', () => {
    const bands = (caps.lteBands ?? []).map((b) => b.band).sort((a, b) => a - b);
    const want = (oracle.lteBands as Array<{ band: number }>).map((b) => b.band).sort((a, b) => a - b);
    expect(bands).toEqual(want);
  });
});
