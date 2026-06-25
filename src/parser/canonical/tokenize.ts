export interface TreeNode {
  key: string;
  value?: string;
  children: TreeNode[];
}

interface Frame {
  node: TreeNode;
  indent: number;
}

const LEAF = /^(.*?)\s:\s(.*)$/;

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Build a node tree from NSG text. Nesting is by relative indentation (a deeper
 * line is a child of the nearest shallower line). Arrow paths `a -> b -> c`
 * expand to nested containers; children attach under the deepest segment.
 */
export function buildTree(text: string): TreeNode {
  const root: TreeNode = { key: '', children: [] };
  const stack: Frame[] = [{ node: root, indent: -1 }];

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const indent = leadingSpaces(raw);
    const content = raw.trim();

    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]!.node;

    const segments = content.split(' -> ');
    const last = segments[segments.length - 1]!;
    const leaf = LEAF.exec(last);

    // Build the (possibly single-element) container chain from all but a leaf tail.
    let cursor = parent;
    const containerSegs = leaf ? segments.slice(0, -1) : segments;
    for (const seg of containerSegs) {
      const node: TreeNode = { key: seg, children: [] };
      cursor.children.push(node);
      cursor = node;
    }

    if (leaf) {
      cursor.children.push({ key: leaf[1]!, value: leaf[2]!, children: [] });
    }
    // A leaf never gains children; keep the chain's last container on the stack.
    stack.push({ node: cursor, indent });
  }

  return root;
}
