import { describe, it, expect } from 'vitest';
import { unsupportedRatTypes } from '../../../src/parser/canonical/transcribe';

// Helper: build a minimal UE-CapabilityRAT-ContainerList block with one rat-Type + container pair.
// Each block is indented under its own [n] sibling so they share a common parent and the
// siblings slice correctly pairs rat-Type with its following ueCapabilityRAT-Container.
function makeBlock(rat: string, index: number): string {
  return [
    `  UE-CapabilityRAT-ContainerList[${index}]`,
    `    rat-Type : ${rat}`,
    `    ueCapabilityRAT-Container : 'DEADBEEF'H`,
  ].join('\n');
}

describe('unsupportedRatTypes', () => {
  it('collects unsupported rat-Types that have a paired container, excluding supported ones', () => {
    // eutra + container → excluded (supported); utra + container → collected; geran-cs + container → collected
    const text = [makeBlock('eutra', 0), makeBlock('utra', 1), makeBlock('geran-cs', 2)].join('\n');
    expect(unsupportedRatTypes(text).sort()).toEqual(['geran-cs', 'utra']);
  });

  it('returns [] for a bare rat-Type with NO following ueCapabilityRAT-Container (no false positive)', () => {
    // A stray rat-Type leaf with no container sibling must NOT be collected.
    const text = '  UE-CapabilityRAT-ContainerList[0]\n    rat-Type : geran-cs\n';
    expect(unsupportedRatTypes(text)).toEqual([]);
  });

  it('returns [] when every rat-Type is supported (eutra, nr, eutra-nr each with a container)', () => {
    const text = [makeBlock('eutra', 0), makeBlock('nr', 1), makeBlock('eutra-nr', 2)].join('\n');
    expect(unsupportedRatTypes(text)).toEqual([]);
  });
});
