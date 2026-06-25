import { expect } from 'vitest';

export function pickFields(obj: unknown, fields: string[]): Record<string, unknown> {
  const o = (obj ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) if (o[f] !== undefined) out[f] = o[f];
  return out;
}

/** Deep-equal only the listed top-level fields of actual vs oracle. */
export function expectCapsFields(actual: unknown, oracle: unknown, fields: string[]): void {
  expect(pickFields(actual, fields)).toEqual(pickFields(oracle, fields));
}
