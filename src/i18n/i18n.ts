import en from './en.json';
import es from './es.json';
import fr from './fr.json';

export type Locale = 'fr' | 'en' | 'es';
export const LOCALES: Locale[] = ['fr', 'en', 'es'];
export const DICTS: Record<Locale, Record<string, string>> = { fr, en, es };

let current: Locale = 'en';

/** Langue à partir de navigator.languages (ex. « fr-CA » → fr). Anglais par défaut. */
export function detectLocale(langs: readonly string[]): Locale {
  for (const l of langs) {
    const base = l.toLowerCase().split('-')[0] as Locale;
    if (LOCALES.includes(base)) return base;
  }
  return 'en';
}

export function setLocale(l: Locale): void {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export function getLocale(): Locale {
  return current;
}

/** Traduit une clé ; `{nom}` est remplacé par params.nom. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}
