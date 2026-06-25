const INT = /^-?\d+$/;
const BIT_STRING_HEX = /^'([0-9A-Fa-f]+)'H(?:\s*\(\d+\))?\s*$/;
const BIT_STRING_BIN = /^'([01 ]+)'B(?:\s*\([^)]*\))?\s*$/;
const BIT_STRING_HEX_BIN = /^'([0-9A-Fa-f]+)'H\s+'([01 ]+)'B(?:\s*\([^)]*\))?\s*$/;

function hexToBin(hex: string): string {
  return hex
    .split('')
    .map((h) => parseInt(h, 16).toString(2).padStart(4, '0'))
    .join('');
}

/** Convert an NSG leaf value string to its canonical JSON scalar. */
export function typeValue(raw: string): boolean | number | string {
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const hexBinBits = BIT_STRING_HEX_BIN.exec(raw);
  if (hexBinBits) {
    return hexToBin(hexBinBits[1]!) + hexBinBits[2]!.replace(/ /g, '');
  }

  const hexBits = BIT_STRING_HEX.exec(raw);
  if (hexBits) {
    return hexToBin(hexBits[1]!);
  }

  const binBits = BIT_STRING_BIN.exec(raw);
  if (binBits) {
    return binBits[1]!.replace(/ /g, '');
  }

  if (INT.test(raw)) return Number(raw);

  return raw;
}
