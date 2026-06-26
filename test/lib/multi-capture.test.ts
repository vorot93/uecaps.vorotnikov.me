import { describe, it, expect } from 'vitest';
import { collectCaptures } from '../../src/lib/multi-capture';
import { readFixtureText, readFixtureJson, normalizeVolatile } from '../parser/harness';
import { expectCapsFields } from '../parser/caps-harness';

const EUTRA = readFixtureText('nsgEutra.input.txt');
const NR = readFixtureText('nsgNr.input.txt');
const EUTRA_FIELDS = ['lteca', 'lteBands', 'lteCategoryDl', 'lteCategoryUl', 'ueCapFilters', 'ratCapabilities'];
const NR_FIELDS = ['nrBands', 'nrca', 'ueCapFilters', 'ratCapabilities'];

describe('collectCaptures — two-device parity (existing fixtures, no new oracle)', () => {
  it('produces device 0 == nsgEutra oracle and device 1 == nsgNr oracle, in order', () => {
    const r = collectCaptures([
      { name: '', text: EUTRA },
      { name: '', text: NR },
    ]);
    expect(r.devices).toHaveLength(2);
    expect(r.allBlank).toBe(false);
    expect(r.cards[0]!.error).toBeUndefined();
    expect(r.cards[1]!.error).toBeUndefined();
    expectCapsFields(
      normalizeVolatile(r.devices[0]),
      normalizeVolatile(readFixtureJson('nsgEutra.caps.json')),
      EUTRA_FIELDS,
    );
    expectCapsFields(
      normalizeVolatile(r.devices[1]),
      normalizeVolatile(readFixtureJson('nsgNr.caps.json')),
      NR_FIELDS,
    );
  });
});

describe('collectCaptures — partial success', () => {
  it('keeps the valid device and reports the failing card without dropping the run', () => {
    const r = collectCaptures([
      { name: '', text: NR },
      { name: '', text: 'garbage that is not NSG' },
    ]);
    expect(r.devices).toHaveLength(1);
    expect(r.cards[0]!.caps).toBeDefined();
    expect(r.cards[0]!.error).toBeUndefined();
    expect(r.cards[1]!.caps).toBeUndefined();
    expect(typeof r.cards[1]!.error).toBe('string');
    expect(r.cards[1]!.blank).toBe(false);
  });
});

describe('collectCaptures — blank cards skipped', () => {
  it('marks a whitespace-only card blank and excludes it from devices', () => {
    const r = collectCaptures([
      { name: '', text: EUTRA },
      { name: '', text: '   \n\t ' },
      { name: '', text: NR },
    ]);
    expect(r.cards[1]!.blank).toBe(true);
    expect(r.cards[0]!.blank).toBe(false);
    expect(r.devices).toHaveLength(2);
  });

  it('reports allBlank with no devices and no labels when every card is empty', () => {
    const r = collectCaptures([
      { name: '', text: '' },
      { name: 'ignored', text: '  ' },
    ]);
    expect(r.allBlank).toBe(true);
    expect(r.devices).toHaveLength(0);
    expect(r.labels).toEqual([]);
  });
});

describe('collectCaptures — labels (numbered by device position)', () => {
  it('falls back to "Capture N" for unnamed devices', () => {
    const r = collectCaptures([
      { name: '', text: EUTRA },
      { name: '', text: NR },
    ]);
    expect(r.labels).toEqual(['Capture 1', 'Capture 2']);
  });

  it('uses the trimmed card name when provided', () => {
    const r = collectCaptures([
      { name: 'Pixel 8', text: EUTRA },
      { name: '  Galaxy S24  ', text: NR },
    ]);
    expect(r.labels).toEqual(['Pixel 8', 'Galaxy S24']);
  });

  it('numbers "Capture N" by device position, so a failed middle card leaves no gap', () => {
    const r = collectCaptures([
      { name: '', text: NR },
      { name: '', text: 'garbage that is not NSG' },
      { name: '', text: EUTRA },
    ]);
    expect(r.devices).toHaveLength(2);
    expect(r.labels).toEqual(['Capture 1', 'Capture 2']);
  });
});
