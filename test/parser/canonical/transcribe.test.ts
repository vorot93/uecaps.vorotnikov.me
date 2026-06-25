import { describe, it, expect } from 'vitest';
import { buildTree } from '../../../src/parser/canonical/tokenize';
import { transcribeNode } from '../../../src/parser/canonical/transcribe';
import { nsgTextToCanonical } from '../../../src/parser/canonical';

describe('transcribeNode', () => {
  it('objects with typed leaves', () => {
    const root = buildTree(['c', '  a : 1', '  b : supported'].join('\n'));
    expect(transcribeNode(root.children[0]!)).toEqual({ a: 1, b: 'supported' });
  });

  it('arrays from [i] markers, named by the parent key', () => {
    const root = buildTree(
      ['bands', '  Band[0]', '    n : 1', '  Band[1]', '    n : 2'].join('\n'),
    );
    expect(transcribeNode(root.children[0]!)).toEqual([{ n: 1 }, { n: 2 }]);
  });
});

describe('nsgTextToCanonical', () => {
  it('keys output by rat-Type and transcribes the container subtree only', () => {
    const text = [
      'ul-dcch',
      '  c1',
      '    ueCapabilityInformation',
      '      ue-CapabilityRAT-ContainerList',
      '        Item[0]',
      '          rat-Type : eutra',
      '          ueCapabilityRAT-Container',
      '            accessStratumRelease : rel11',
      '            ue-Category : 4',
      '        Item[1]',
      '          rat-Type : nr',
      '          ue-CapabilityRAT-Container',
      '            accessStratumRelease : rel15',
    ].join('\n');
    expect(nsgTextToCanonical(text)).toEqual({
      eutra: { accessStratumRelease: 'rel11', 'ue-Category': 4 },
      nr: { accessStratumRelease: 'rel15' },
    });
  });
});
