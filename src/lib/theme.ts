export type Theme = 'system' | 'light' | 'dark';

/** PURE — the dark decision; unit-tested. */
export function resolveDark(theme: Theme, systemDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemDark);
}

/** Browser: read the persisted preference ('system' when absent/invalid). */
export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Browser: persist the preference and apply the `.dark` class on <html>. */
export function applyTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
    const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', resolveDark(theme, systemDark));
  } catch {
    /* localStorage/matchMedia unavailable — leave the current class as-is */
  }
}

/** Self-contained pre-paint init for the inline <head> script (mirrors resolveDark). */
export const THEME_INIT =
  `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches));}catch(e){}})()`;
