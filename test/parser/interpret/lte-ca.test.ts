import { describe, it } from 'vitest';
import { interpret } from '../../../src/parser/interpret';
import { nsgTextToCanonical } from '../../../src/parser/canonical';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../harness';
import { expectCapsFields } from '../caps-harness';

const caps = interpret(nsgTextToCanonical(readFixtureText('nsgEutra.input.txt')));
const oracle = readFixtureJson('nsgEutra.caps.json');

describe('LTE CA: nsgEutra full LTE parity', () => {
  it('lteca + lteBands + lteCategory deep-equal the oracle (LTE fields only)', () => {
    expectCapsFields(
      normalizeVolatile(caps),
      normalizeVolatile(oracle),
      ['lteca', 'lteBands', 'lteCategoryDl', 'lteCategoryUl'],
    );
  });
});
