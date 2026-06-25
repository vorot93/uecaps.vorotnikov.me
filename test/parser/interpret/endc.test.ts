/**
 * Full-parity gate for EN-DC combos (Task 6).
 *
 * Tests: expectCapsFields(normalizeVolatile(caps), normalizeVolatile(nsgMrdc oracle),
 *   ['lteca','lteBands','lteCategoryDl','lteCategoryUl','nrNsaBandsEutra','nrBands','endc'])
 *
 * This covers full nsgMrdc parity — LTE fields from Plan 3 + NR fields from this plan + endc.
 * 52 endc combos.
 */
import { describe, it } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';
import { expectCapsFields } from '../caps-harness';

const caps = interpret(nsgTextToCanonical(readFixtureText('nsgMrdc.input.txt')));
const oracle = readFixtureJson('nsgMrdc.caps.json');

describe('EN-DC combos: nsgMrdc full parity', () => {
  it('endc + nrBands + nrNsaBandsEutra + LTE fields deep-equal the nsgMrdc oracle', () => {
    expectCapsFields(normalizeVolatile(caps), normalizeVolatile(oracle), [
      'lteca',
      'lteBands',
      'lteCategoryDl',
      'lteCategoryUl',
      'nrNsaBandsEutra',
      'nrBands',
      'nrca',
      'endc',
      'ueCapFilters',
      'ratCapabilities',
    ]);
  });
});
