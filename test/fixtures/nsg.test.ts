import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'nsg');

describe('nsg fixtures', () => {
  for (const name of ['nsgEutra', 'nsgNr', 'nsgMrdc']) {
    it(`${name}: input + oracle present and non-trivial`, () => {
      const input = readFileSync(join(dir, `${name}.input.txt`), 'utf8');
      const oracle = JSON.parse(readFileSync(join(dir, `${name}.ueLog.json`), 'utf8'));
      expect(input.length).toBeGreaterThan(100);
      expect(Object.keys(oracle).length).toBeGreaterThan(0);
    });
  }
});
