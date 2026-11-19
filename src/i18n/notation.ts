import { QUALITY_SUFFIX, type Chord } from '../theory/chords';
import { keySpelling, type Key } from '../theory/keys';
import { spell, type SpelledNote, type Spelling } from '../theory/notes';
import { prettyAccidentals } from '../theory/roman';
import type { Locale } from './i18n';

/** Notation des notes, réglable indépendamment de la langue. */
export type Notation = 'anglo' | 'latin';

const ANGLO = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LATIN_FR = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const LATIN = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

/** Par défaut : espagnol → latine ; français et anglais → anglo-saxonne. */
export function defaultNotation(locale: Locale): Notation {
  return locale === 'es' ? 'latin' : 'anglo';
}

export function noteName(n: SpelledNote, notation: Notation, locale: Locale): string {
  const letters = notation === 'anglo' ? ANGLO : locale === 'fr' ? LATIN_FR : LATIN;
  const acc = n.accidental === 1 ? '♯' : n.accidental === -1 ? '♭' : '';
  return letters[n.letter]! + acc;
}

export function pcName(pc: number, notation: Notation, locale: Locale, spelling: Spelling = 'sharp'): string {
  return noteName(spell(pc, spelling), notation, locale);
}

/** « Am », « F♯7 », « Lam », « Fa♯7 »… L'orthographe suit la tonalité (B♭ en Fa, A♯ en Si). */
export function chordName(c: Chord, notation: Notation, locale: Locale, key: Key | null = null, spelling?: Spelling): string {
  return pcName(c.root, notation, locale, spelling ?? keySpelling(key)) + QUALITY_SUFFIX[c.quality];
}

/** Orthographe imposée par le degré : ♭VII s'écrit avec un bémol (B♭ en Do), ♯IV avec un dièse. */
export function spellingForRoman(roman: string, key: Key | null): Spelling {
  if (roman.startsWith('b')) return 'flat';
  if (roman.startsWith('#')) return 'sharp';
  return keySpelling(key);
}

export function romanPretty(s: string): string {
  return prettyAccidentals(s);
}

const LETTER_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, do: 0, re: 2, 'ré': 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const SUFFIX_QUALITY: [string, Chord['quality']][] = [
  ['maj7', 'maj7'],
  ['m7', 'm7'],
  ['min7', 'm7'],
  ['sus2', 'sus2'],
  ['sus4', 'sus4'],
  ['dim', 'dim'],
  ['°', 'dim'],
  ['min', 'min'],
  ['m', 'min'],
  ['7', '7'],
  ['', 'maj'],
];

/**
 * Lit un nom d'accord en notation anglo-saxonne ou latine : « Am », « F#7 », « Bb », « Lam », « Fa#7 », « Sib ».
 * Retourne null si le nom n'est pas reconnu.
 */
export function parseChordName(raw: string): Chord | null {
  const txt = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = /^(do|ré|re|mi|fa|sol|la|si|[a-g])([#b]?)(.*)$/i.exec(txt);
  if (!m) return null;
  const base = LETTER_PC[m[1]!.toLowerCase()];
  if (base === undefined) return null;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  // « Sib » : le b final est un bémol, pas « si + b ». Déjà géré par le groupe 2.
  const rest = m[3]!;
  const found = SUFFIX_QUALITY.find(([suf]) => rest.toLowerCase() === suf);
  if (!found) return null;
  return { root: (((base + acc) % 12) + 12) % 12, quality: found[1] };
}

/** Lit une progression séparée par espaces, virgules, tirets ou barres. */
export function parseProgression(text: string): { chords: Chord[]; invalid: string[] } {
  const parts = text.split(/[\s,;|–—-]+/).filter(Boolean);
  const chords: Chord[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const c = parseChordName(p);
    if (c) chords.push(c);
    else invalid.push(p);
  }
  return { chords, invalid };
}
