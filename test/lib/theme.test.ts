import { describe, it, expect } from 'vitest';
import { resolveDark, THEME_INIT } from '../../src/lib/theme';

describe('resolveDark', () => {
  it('dark is always dark', () => {
    expect(resolveDark('dark', false)).toBe(true);
    expect(resolveDark('dark', true)).toBe(true);
  });
  it('light is always light', () => {
    expect(resolveDark('light', true)).toBe(false);
    expect(resolveDark('light', false)).toBe(false);
  });
  it('system follows the OS preference', () => {
    expect(resolveDark('system', true)).toBe(true);
    expect(resolveDark('system', false)).toBe(false);
  });
});

describe('THEME_INIT', () => {
  it('references the browser APIs it needs and no forbidden server tokens', () => {
    expect(THEME_INIT).toContain('localStorage');
    expect(THEME_INIT).toContain('matchMedia');
    expect(THEME_INIT).toContain('classList');
    expect(THEME_INIT).not.toContain('fetch(');
    expect(THEME_INIT).not.toContain('axios');
  });
});
