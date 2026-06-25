import { describe, it, expect } from 'vitest';
import { pickFields } from './caps-harness';

describe('caps harness', () => {
  it('picks only the listed fields', () => {
    const obj = { lteBands: [1], lteca: [2], ueCapFilters: [9], timestamp: 7 };
    expect(pickFields(obj, ['lteBands', 'lteca'])).toEqual({ lteBands: [1], lteca: [2] });
  });
  it('omits a field absent from the object', () => {
    expect(pickFields({ a: 1 }, ['a', 'b'])).toEqual({ a: 1 });
  });
});
