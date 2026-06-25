import { describe, it, expect } from 'vitest';
import { getObject, getArray, getInt, getString, getBool, getObjectAtPath, getArrayAtPath, asArray } from '../../src/parser/json';

const o = { a: { b: { c: [1, 2] } }, n: 5, s: 'x', t: true, arr: [9] };

describe('json helpers', () => {
  it('getObject/getArray/getInt/getString/getBool', () => {
    expect(getObject(o, 'a')).toEqual({ b: { c: [1, 2] } });
    expect(getArray(o, 'arr')).toEqual([9]);
    expect(getInt(o, 'n')).toBe(5);
    expect(getString(o, 's')).toBe('x');
    expect(getBool(o, 't')).toBe(true);
  });
  it('returns undefined on type mismatch, never throws', () => {
    expect(getObject(o, 'n')).toBeUndefined();
    expect(getInt(o, 's')).toBeUndefined();
    expect(getObject(undefined, 'a')).toBeUndefined();
    expect(getArray(5, 'x')).toBeUndefined();
  });
  it('path accessors', () => {
    expect(getArrayAtPath(o, 'a.b.c')).toEqual([1, 2]);
    expect(getObjectAtPath(o, 'a.b')).toEqual({ c: [1, 2] });
    expect(getObjectAtPath(o, 'a.missing')).toBeUndefined();
  });
  it('asArray', () => {
    expect(asArray([1])).toEqual([1]);
    expect(asArray({})).toBeUndefined();
  });
});
