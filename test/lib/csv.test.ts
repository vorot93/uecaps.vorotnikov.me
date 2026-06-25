import { describe, it, expect } from 'vitest';
import { capabilitiesToCsv, stripHtml, csvCell } from '../../src/lib/csv';
import { interpret } from '../../src/parser/interpret';
import { nsgTextToCanonical } from '../../src/parser/canonical';
import { readFixtureText } from '../parser/harness';
import {
  componentsDlToStr,
  componentsMimoDlToStr,
  componentsModDlToStr,
  componentsUlToStr,
  componentsMimoUlToStr,
  componentsModUlToStr,
  bcsToStr,
  componentsScsDlToStr,
  componentsBwDlToStr,
  componentsScsUlToStr,
  componentsBwUlToStr,
  ulTxSwitchToStr,
} from '../../src/helpers/combos';
import type { Capabilities, BwClass } from '../../src/parser/types/uecapabilityparser';

describe('stripHtml', () => {
  it('removes tags, keeps text and the " + " separators', () => {
    expect(
      stripHtml('<span class="font-semibold B3">3A</span> + <span class="font-semibold B7">7A</span>'),
    ).toBe('3A + 7A');
  });
});

describe('csvCell (RFC-4180)', () => {
  it('quotes a cell containing a comma', () => expect(csvCell('4, 2')).toBe('"4, 2"'));
  it('passes a plain cell through', () => expect(csvCell('256')).toBe('256'));
  it('doubles embedded quotes and wraps', () => expect(csvCell('a"b')).toBe('"a""b"'));
});

describe('capabilitiesToCsv — LTE CA (nsgEutra)', () => {
  const caps = interpret(nsgTextToCanonical(readFixtureText('nsgEutra.input.txt')));
  const csv = capabilitiesToCsv(caps);

  it('starts with the LTE CA Combos title + header row', () => {
    expect(csv.startsWith('LTE CA Combos\nLTE DL,MIMO DL,Mod DL (QAM),LTE UL,MIMO UL,Mod UL (QAM),BCS\n')).toBe(true);
  });
  it('first combo row equals the display helpers (plain text, escaped)', () => {
    const c = caps.lteca![0]!;
    const row = [
      stripHtml(componentsDlToStr(c.components)),
      stripHtml(componentsMimoDlToStr(c.components)),
      stripHtml(componentsModDlToStr(c.components)),
      stripHtml(componentsUlToStr(c.components)),
      stripHtml(componentsMimoUlToStr(c.components)),
      stripHtml(componentsModUlToStr(c.components)),
      stripHtml(bcsToStr(c.bcs)),
    ].map(csvCell).join(',');
    expect(csv).toContain('\n' + row + '\n');
  });
  it('has exactly title + header + one row per combo (LTE-CA is the only section for nsgEutra)', () => {
    const lines = csv.replace(/\n$/, '').split('\n');
    expect(lines.length).toBe(2 + caps.lteca!.length);
  });
});

describe('capabilitiesToCsv — NR CA (nsgNr)', () => {
  const caps = interpret(nsgTextToCanonical(readFixtureText('nsgNr.input.txt')));
  const csv = capabilitiesToCsv(caps);
  it('has the NR CA Combos section with the full 12-column header', () => {
    expect(csv).toContain('NR CA Combos\nNR DL,MIMO DL,MOD DL (QAM),SCS DL (kHz),BW DL (MHz),NR UL,MIMO UL,MOD UL (QAM),SCS UL (kHz),BW UL (MHz),UL TX Switch,BCS\n');
  });
  it('omits sections with no combos (no LTE CA / EN-DC / NR DC for nsgNr)', () => {
    expect(csv).not.toContain('LTE CA Combos');
    expect(csv).not.toContain('EN-DC Combos');
    expect(csv).not.toContain('NR DC Combos');
  });
});

describe('capabilitiesToCsv — EN-DC (nsgMrdc), on-screen order', () => {
  const caps = interpret(nsgTextToCanonical(readFixtureText('nsgMrdc.input.txt')));
  const csv = capabilitiesToCsv(caps);
  it('contains the EN-DC Combos section + its 19-column header', () => {
    expect(csv).toContain('EN-DC Combos\nLTE DL,LTE MIMO DL,LTE MOD DL (QAM),NR DL,NR MIMO DL,NR MOD DL (QAM),NR SCS DL (kHz),NR BW DL (MHz),LTE UL,LTE MIMO UL,LTE Mod UL (QAM),NR UL,NR MIMO UL,NR MOD UL (QAM),NR SCS UL (kHz),NR BW UL (MHz),BCS LTE,BCS NR,BCS INTRA ENDC\n');
  });
  it('orders LTE CA before EN-DC (on-screen order)', () => {
    expect(csv.indexOf('LTE CA Combos')).toBeGreaterThanOrEqual(0);
    expect(csv.indexOf('LTE CA Combos')).toBeLessThan(csv.indexOf('EN-DC Combos'));
  });
});

describe('capabilitiesToCsv — NR DC (synthetic; no fixture exercises nrdc)', () => {
  // Start from a valid parsed Capabilities, then inject one NR-DC combo and clear others.
  const base = interpret(nsgTextToCanonical(readFixtureText('nsgNr.input.txt')));
  const caps: Capabilities = {
    ...base,
    lteca: undefined,
    nrca: undefined,
    endc: undefined,
    nrdc: [
      {
        componentsFr1: [{ band: 78, bwClassDl: 'A' as BwClass }],
        componentsFr2: [{ band: 257, bwClassDl: 'A' as BwClass }],
      },
    ],
  };
  const csv = capabilitiesToCsv(caps);
  it('emits the NR DC Combos section with its 21-column header and the bands', () => {
    expect(csv.startsWith('NR DC Combos\nFR1 DL,FR1 MIMO DL,')).toBe(true);
    expect(csv).toContain('FR2 BW UL (MHz),BCS\n');
    expect(csv).toContain('78');
    expect(csv).toContain('257');
  });
});
