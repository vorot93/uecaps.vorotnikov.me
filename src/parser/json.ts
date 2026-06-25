function rec(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
export function getObject(v: unknown, key: string): Record<string, unknown> | undefined {
  return rec(rec(v)?.[key]);
}
export function getArray(v: unknown, key: string): unknown[] | undefined {
  const x = rec(v)?.[key];
  return Array.isArray(x) ? x : undefined;
}
export function getInt(v: unknown, key: string): number | undefined {
  const x = rec(v)?.[key];
  return typeof x === 'number' && Number.isInteger(x) ? x : undefined;
}
export function getString(v: unknown, key: string): string | undefined {
  const x = rec(v)?.[key];
  return typeof x === 'string' ? x : undefined;
}
export function getBool(v: unknown, key: string): boolean | undefined {
  const x = rec(v)?.[key];
  return typeof x === 'boolean' ? x : undefined;
}
export function getObjectAtPath(v: unknown, path: string): Record<string, unknown> | undefined {
  let cur = rec(v);
  for (const seg of path.split('.')) cur = getObject(cur, seg);
  return cur;
}
export function getArrayAtPath(v: unknown, path: string): unknown[] | undefined {
  const segs = path.split('.');
  let cur = rec(v);
  for (let i = 0; i < segs.length - 1; i++) cur = getObject(cur, segs[i]!);
  return getArray(cur, segs[segs.length - 1]!);
}
export function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined;
}
