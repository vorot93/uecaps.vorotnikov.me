import { describe, it, expect } from 'vitest';
import { collectCaptures } from '../../src/lib/multi-capture';
import { EXAMPLE_NSG, EXAMPLE_LABEL } from '../../src/lib/example-capture';

describe('example-capture', () => {
  it('EXAMPLE_LABEL is the demo device name', () => {
    expect(EXAMPLE_LABEL).toBe('Example device');
  });

  it('EXAMPLE_NSG decodes to one device with NR bands and at least one NR-CA combo', () => {
    const r = collectCaptures([{ name: '', text: EXAMPLE_NSG }]);
    expect(r.devices.length).toBeGreaterThanOrEqual(1);
    const dev = r.devices[0]!;
    expect(dev.nrBands).toBeDefined();
    expect(dev.nrBands!.length).toBeGreaterThan(0);
    expect(dev.nrca).toBeDefined();
    expect(dev.nrca!.length).toBeGreaterThanOrEqual(1);
  });

  it('EXAMPLE_NSG is a trimmed sample, not the whole fixture', () => {
    // Loose ceiling: the full nsgNr fixture is ~40 KB; any real trim beats this.
    // This only catches "accidentally pasted the entire fixture".
    expect(EXAMPLE_NSG.length).toBeLessThan(38_000);
  });
});
