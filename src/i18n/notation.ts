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
