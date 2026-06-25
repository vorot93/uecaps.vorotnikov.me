import { describe, it, expect } from 'vitest';
import { parseInput } from '../../src/lib/parse-input';
import { readFixtureText } from '../parser/harness';

describe('parseInput partial-parse warnings', () => {
  it('renders LTE caps AND warns about skipped GERAN (CS) and GERAN (PS) containers in nsgEutra', () => {
    // nsgEutra contains real GERAN containers at UE-CapabilityRAT-ContainerList[1] and [2];
    // the viewer skips them, so §9 warnings should fire.
    const r = parseInput(readFixtureText('nsgEutra.input.txt'));
    expect(r.caps.length).toBe(1);
    expect(r.error).toBeUndefined();
    expect(r.warnings).toContain('Skipped unsupported capability: GERAN (CS)');
    expect(r.warnings).toContain('Skipped unsupported capability: GERAN (PS)');
  });

  it('no warnings on a clean NR capture (nsgNr has only rat-Type : nr)', () => {
    // nsgNr.input.txt contains only a single rat-Type : nr with its container — no unsupported RATs.
    const r = parseInput(readFixtureText('nsgNr.input.txt'));
    expect(r.caps.length).toBe(1);
    expect(r.warnings).toBeUndefined();
  });
});
