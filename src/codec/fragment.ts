export function toFragment(payload: string): string {
  return `#d=${payload}`;
}

export function parseFragment(hash: string): string | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  const match = /^d=(.*)$/.exec(normalized);
  return match ? match[1]! : null;
}
