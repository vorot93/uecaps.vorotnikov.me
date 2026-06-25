import { describe, it, expect } from 'vitest';
import { typeValue } from '../../../src/parser/canonical/value';

describe('typeValue', () => {
  it('booleans', () => {
    expect(typeValue('true')).toBe(true);
    expect(typeValue('false')).toBe(false);
  });

  it('integers', () => {
    expect(typeValue('4')).toBe(4);
    expect(typeValue('-3')).toBe(-3);
  });

  it('BIT STRING hex -> binary string (4 bits per hex digit)', () => {
    expect(typeValue("'C0000000'H (3221225472)")).toBe('11000000000000000000000000000000');
    expect(typeValue("'8'H")).toBe('1000');
  });

  it('BIT STRING hex tolerates trailing whitespace', () => {
    expect(typeValue("'F'H ")).toBe('1111');
  });

  it('BIT STRING hex tolerates multiple spaces before decimal suffix', () => {
    expect(typeValue("'F'H  (15)")).toBe('1111');
  });

  it('enums / labels stay strings', () => {
    expect(typeValue('rel11')).toBe('rel11');
    expect(typeValue('cs16')).toBe('cs16');
    expect(typeValue('supported')).toBe('supported');
    expect(typeValue('type2')).toBe('type2');
  });
});
