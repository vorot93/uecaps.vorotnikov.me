import type { Capabilities, ComboLte, ComboNr, ComboEnDc, ComboNrDc } from '~/parser/types/uecapabilityparser';
import {
  componentsDlToStr,
  componentsUlToStr,
  componentsMimoDlToStr,
  componentsMimoUlToStr,
  componentsModDlToStr,
  componentsModUlToStr,
  bcsToStr,
  componentsScsDlToStr,
  componentsScsUlToStr,
  componentsBwDlToStr,
  componentsBwUlToStr,
  ulTxSwitchToStr,
} from '~/helpers/combos';

/** Strip HTML tags (the combos.ts helpers wrap band cells in <span>…</span>). */
export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/** RFC-4180 cell: quote (and double internal quotes) iff it contains , " CR or LF. */
export function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

const LTE_CA_HEADERS = ['LTE DL', 'MIMO DL', 'Mod DL (QAM)', 'LTE UL', 'MIMO UL', 'Mod UL (QAM)', 'BCS'];

function lteCaSection(combos: ComboLte[] | undefined): string[] {
  if (combos === undefined || combos.length === 0) return [];
  const lines = [csvRow(['LTE CA Combos']), csvRow(LTE_CA_HEADERS)];
  for (const { components, bcs } of combos) {
    lines.push(
      csvRow([
        stripHtml(componentsDlToStr(components)),
        stripHtml(componentsMimoDlToStr(components)),
        stripHtml(componentsModDlToStr(components)),
        stripHtml(componentsUlToStr(components)),
        stripHtml(componentsMimoUlToStr(components)),
        stripHtml(componentsModUlToStr(components)),
        stripHtml(bcsToStr(bcs)),
      ]),
    );
  }
  return lines;
}

const ENDC_HEADERS = ['LTE DL', 'LTE MIMO DL', 'LTE MOD DL (QAM)', 'NR DL', 'NR MIMO DL', 'NR MOD DL (QAM)', 'NR SCS DL (kHz)', 'NR BW DL (MHz)', 'LTE UL', 'LTE MIMO UL', 'LTE Mod UL (QAM)', 'NR UL', 'NR MIMO UL', 'NR MOD UL (QAM)', 'NR SCS UL (kHz)', 'NR BW UL (MHz)', 'BCS LTE', 'BCS NR', 'BCS INTRA ENDC'];

function endcSection(combos: ComboEnDc[] | undefined): string[] {
  if (combos === undefined || combos.length === 0) return [];
  const lines = [csvRow(['EN-DC Combos']), csvRow(ENDC_HEADERS)];
  for (const { componentsLte, componentsNr, bcsEutra, bcsNr, bcsIntraEndc } of combos) {
    lines.push(
      csvRow([
        stripHtml(componentsDlToStr(componentsLte)),
        stripHtml(componentsMimoDlToStr(componentsLte)),
        stripHtml(componentsModDlToStr(componentsLte)),
        stripHtml(componentsDlToStr(componentsNr, true)),
        stripHtml(componentsMimoDlToStr(componentsNr, true)),
        stripHtml(componentsModDlToStr(componentsNr, true)),
        stripHtml(componentsScsDlToStr(componentsNr)),
        stripHtml(componentsBwDlToStr(componentsNr)),
        stripHtml(componentsUlToStr(componentsLte)),
        stripHtml(componentsMimoUlToStr(componentsLte)),
        stripHtml(componentsModUlToStr(componentsLte)),
        stripHtml(componentsUlToStr(componentsNr, true)),
        stripHtml(componentsMimoUlToStr(componentsNr, true)),
        stripHtml(componentsModUlToStr(componentsNr, true)),
        stripHtml(componentsScsUlToStr(componentsNr)),
        stripHtml(componentsBwUlToStr(componentsNr)),
        stripHtml(bcsToStr(bcsEutra)),
        stripHtml(bcsToStr(bcsNr)),
        stripHtml(bcsToStr(bcsIntraEndc)),
      ]),
    );
  }
  return lines;
}

const NR_CA_HEADERS = ['NR DL', 'MIMO DL', 'MOD DL (QAM)', 'SCS DL (kHz)', 'BW DL (MHz)', 'NR UL', 'MIMO UL', 'MOD UL (QAM)', 'SCS UL (kHz)', 'BW UL (MHz)', 'UL TX Switch', 'BCS'];

function nrCaSection(combos: ComboNr[] | undefined): string[] {
  if (combos === undefined || combos.length === 0) return [];
  const supportUlTxSwitch = combos.some((c) => (c.uplinkTxSwitch?.length ?? 0) > 0);
  const lines = [csvRow(['NR CA Combos']), csvRow(NR_CA_HEADERS)];
  for (const { components, bcs, uplinkTxSwitch } of combos) {
    lines.push(
      csvRow([
        stripHtml(componentsDlToStr(components, true)),
        stripHtml(componentsMimoDlToStr(components, true)),
        stripHtml(componentsModDlToStr(components, true)),
        stripHtml(componentsScsDlToStr(components)),
        stripHtml(componentsBwDlToStr(components)),
        stripHtml(componentsUlToStr(components, true)),
        stripHtml(componentsMimoUlToStr(components, true)),
        stripHtml(componentsModUlToStr(components, true)),
        stripHtml(componentsScsUlToStr(components)),
        stripHtml(componentsBwUlToStr(components)),
        stripHtml(ulTxSwitchToStr(uplinkTxSwitch, supportUlTxSwitch)),
        stripHtml(bcsToStr(bcs)),
      ]),
    );
  }
  return lines;
}

const NR_DC_HEADERS = ['FR1 DL', 'FR1 MIMO DL', 'FR1 MOD DL (QAM)', 'FR1 SCS DL (kHz)', 'FR1 BW DL (MHz)', 'FR2 DL', 'FR2 MIMO DL', 'FR2 MOD DL (QAM)', 'FR2 SCS DL (kHz)', 'FR2 BW DL (MHz)', 'FR1 UL', 'FR1 MIMO UL', 'FR1 MOD UL (QAM)', 'FR1 SCS UL (kHz)', 'FR1 BW UL (MHz)', 'FR2 UL', 'FR2 MIMO UL', 'FR2 MOD UL (QAM)', 'FR2 SCS UL (kHz)', 'FR2 BW UL (MHz)', 'BCS'];

function nrdcSection(combos: ComboNrDc[] | undefined): string[] {
  if (combos === undefined || combos.length === 0) return [];
  const lines = [csvRow(['NR DC Combos']), csvRow(NR_DC_HEADERS)];
  for (const { componentsFr1, componentsFr2, bcs } of combos) {
    const cells: string[] = [];
    for (const components of [componentsFr1, componentsFr2]) {
      cells.push(
        stripHtml(componentsDlToStr(components, true)),
        stripHtml(componentsMimoDlToStr(components, true)),
        stripHtml(componentsModDlToStr(components, true)),
        stripHtml(componentsScsDlToStr(components)),
        stripHtml(componentsBwDlToStr(components)),
      );
    }
    for (const components of [componentsFr1, componentsFr2]) {
      cells.push(
        stripHtml(componentsUlToStr(components, true)),
        stripHtml(componentsMimoUlToStr(components, true)),
        stripHtml(componentsModUlToStr(components, true)),
        stripHtml(componentsScsUlToStr(components)),
        stripHtml(componentsBwUlToStr(components)),
      );
    }
    cells.push(stripHtml(bcsToStr(bcs)));
    lines.push(csvRow(cells));
  }
  return lines;
}

/** Serialize one capability's combo tables to CSV (on-screen section order). */
export function capabilitiesToCsv(caps: Capabilities): string {
  const sections = [
    lteCaSection(caps.lteca),
    endcSection(caps.endc),
    nrCaSection(caps.nrca),
    nrdcSection(caps.nrdc),
  ].filter((s) => s.length > 0);
  if (sections.length === 0) return '';
  return sections.map((s) => s.join('\n')).join('\n\n') + '\n';
}
