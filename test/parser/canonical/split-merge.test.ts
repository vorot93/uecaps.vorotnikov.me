import { describe, it, expect } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';
import { expectCapsFields } from '../caps-harness';

const merged = nsgTextToCanonical(
  readFixtureText('nsgMrdcSplit_0.txt') + '\n' + readFixtureText('nsgMrdcSplit_1.txt'),
);
const caps = interpret(merged);
const oracle = readFixtureJson('nsgMrdcSplit.caps.json');

describe('merge keeps the populated RAT (no clobber, order-independent)', () => {
  // Two "messages": one carries a populated eutra container, the other an empty one.
  const populated =
    'rat-Type : eutra\n' +
    'ueCapabilityRAT-Container\n' +
    '  accessStratumRelease : rel11\n';
  const empty = 'rat-Type : eutra\n' + 'ueCapabilityRAT-Container\n';

  it('populated-first: keeps the populated eutra', () => {
    const out = nsgTextToCanonical(populated + empty) as Record<string, unknown>;
    expect(out.eutra).toEqual({ accessStratumRelease: 'rel11' });
  });
  it('empty-first: still keeps the populated eutra', () => {
    const out = nsgTextToCanonical(empty + populated) as Record<string, unknown>;
    expect(out.eutra).toEqual({ accessStratumRelease: 'rel11' });
  });
});

describe('split-half merge: nsgMrdcSplit (two messages -> one device)', () => {
  it('the merged canonical carries all three RAT keys', () => {
    expect(Object.keys(merged).sort()).toEqual(['eutra', 'eutra-nr', 'nr']);
  });

  it('caps deep-equal the nsgMrdcSplit oracle (populated fields)', () => {
    expectCapsFields(normalizeVolatile(caps), normalizeVolatile(oracle), [
      'lteca',
      'lteBands',
      'lteCategoryDl',
      'lteCategoryUl',
      'nrNsaBandsEutra',
      'nrBands',
      'endc',
      'ueCapFilters',
      'ratCapabilities',
    ]);
  });
});
