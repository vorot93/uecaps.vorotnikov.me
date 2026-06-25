import { describe, it, expect } from 'vitest';
import { buildTree, type TreeNode } from '../../../src/parser/canonical/tokenize';

const kid = (root: TreeNode, key: string) => root.children.find((c) => c.key === key)!;

describe('buildTree', () => {
  it('nests by indentation and parses leaves', () => {
    const root = buildTree(['a', '  b : 1', '  c', '    d : x'].join('\n'));
    const a = kid(root, 'a');
    expect(kid(a, 'b').value).toBe('1');
    expect(kid(kid(a, 'c'), 'd').value).toBe('x');
  });

  it('expands arrow paths into nested containers', () => {
    const root = buildTree(['x -> y -> z', ' w : 1'].join('\n'));
    const z = kid(kid(kid(root, 'x'), 'y'), 'z');
    expect(kid(z, 'w').value).toBe('1');
  });

  it('keeps array-marker keys verbatim as children', () => {
    const root = buildTree(['list', '  Item[0]', '    n : 1', '  Item[1]', '    n : 2'].join('\n'));
    const list = kid(root, 'list');
    expect(list.children.map((c) => c.key)).toEqual(['Item[0]', 'Item[1]']);
    expect(kid(list.children[0]!, 'n').value).toBe('1');
  });

  it('handles single-space (NR) indentation the same way', () => {
    const root = buildTree(['a', ' b', '  c : 1'].join('\n'));
    expect(kid(kid(kid(root, 'a'), 'b'), 'c').value).toBe('1');
  });
});
