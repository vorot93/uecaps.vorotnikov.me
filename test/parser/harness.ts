import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'nsg');

export function readFixtureText(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

export function readFixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

const VOLATILE = new Set(['timestamp', 'processingTime', 'parserVersion', 'id']);

export function normalizeVolatile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeVolatile);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (VOLATILE.has(k)) continue;
      out[k] = normalizeVolatile(v);
    }
    return out;
  }
  return value;
}
