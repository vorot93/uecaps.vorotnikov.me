import type { TreeNode } from './tokenize';
import { typeValue } from './value';

const ARRAY_MARKER = /\[\d+\]$/;
const RAT_CONTAINER = /^ue-?CapabilityRAT-Container$/i;
const RAT_VALUES = new Set(['eutra', 'nr', 'eutra-nr']);

// NSG emits some IE names without the ASN.1 version suffix the canonical model keeps
// (e.g. EUTRA ROHC profile0x0001 → profile0x0001-r15, maxNumberConfiguredTCIstatesPerCC →
// maxNumberConfiguredTCI-StatesPerCC); renames are RAT-scoped.
/** Key renames that apply to all RAT types. */
const KEY_RENAMES_COMMON: Record<string, string> = {
  maxNumberConfiguredTCIstatesPerCC: 'maxNumberConfiguredTCI-StatesPerCC',
};

/** Key renames that apply only to EUTRA (LTE) RAT. */
const KEY_RENAMES_EUTRA: Record<string, string> = {
  'profile0x0001': 'profile0x0001-r15',
  'profile0x0002': 'profile0x0002-r15',
  'profile0x0003': 'profile0x0003-r15',
  'profile0x0004': 'profile0x0004-r15',
  'profile0x0006': 'profile0x0006-r15',
  'profile0x0101': 'profile0x0101-r15',
  'profile0x0102': 'profile0x0102-r15',
  'profile0x0103': 'profile0x0103-r15',
  'profile0x0104': 'profile0x0104-r15',
};

function normalizeKey(key: string, rat: string): string {
  if (rat === 'eutra') {
    const renamed = KEY_RENAMES_EUTRA[key];
    if (renamed !== undefined) return renamed;
  }
  return KEY_RENAMES_COMMON[key] ?? key;
}

export function transcribeNode(node: TreeNode, rat = ''): unknown {
  if (node.value !== undefined) return typeValue(node.value);

  const kids = node.children;
  if (kids.length === 0) return {};

  if (kids.every((k) => ARRAY_MARKER.test(k.key))) {
    const baseNames = kids.map((k) => k.key.replace(ARRAY_MARKER, ''));
    // Bare [i] markers (empty base) or Uppercase-initial base names → direct array
    if (baseNames.every((n) => n === '' || /^[A-Z]/.test(n))) {
      return kids.map((k) => transcribeNode(k, rat));
    }
    // Lowercase-initial base names → group by base name into a named-array object
    const obj: Record<string, unknown[]> = {};
    for (let i = 0; i < kids.length; i++) {
      const base = normalizeKey(baseNames[i]!, rat);
      if (!obj[base]) obj[base] = [];
      obj[base]!.push(transcribeNode(kids[i]!, rat));
    }
    return obj;
  }

  // All children are uppercase-keyed leaf nodes → unwrap values into an array
  if (kids.length === 1 && kids.every((k) => k.value !== undefined && /^[A-Z]/.test(k.key))) {
    return kids.map((k) => typeValue(k.value!));
  }

  const obj: Record<string, unknown> = {};
  for (const kid of kids) obj[normalizeKey(kid.key, rat)] = transcribeNode(kid, rat);
  return obj;
}

/** Depth-first walk yielding every node in the tree. */
function* walk(node: TreeNode): Generator<TreeNode> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

export function ratContainers(root: TreeNode): Array<{ rat: string; container: TreeNode }> {
  const found: Array<{ rat: string; container: TreeNode }> = [];
  for (const node of walk(root)) {
    const siblings = node.children;
    for (const ratType of siblings) {
      if (ratType.key !== 'rat-Type' || ratType.value === undefined) continue;
      if (!RAT_VALUES.has(ratType.value)) continue;
      const container = siblings.find((s) => RAT_CONTAINER.test(s.key));
      if (container) found.push({ rat: ratType.value, container });
    }
  }
  return found;
}
