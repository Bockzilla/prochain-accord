import { isMinorish, type Chord } from './chords';
import type { Key } from './keys';
import { mod12 } from './notes';

// Degrés chromatiques relatifs à la tonique.
const MAJOR_DEGREES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const MINOR_DEGREES = ['I', 'bII', 'II', 'III', '#III', 'IV', '#IV', 'V', 'VI', '#VI', 'VII', '#VII'];

const QUALITY_MARK: Record<Chord['quality'], string> = {
  maj: '',
  min: '',
  '7': '7',
  maj7: 'maj7',
  m7: '7',
  sus2: 'sus2',
  sus4: 'sus4',
  dim: '°',
};

/** Chiffre romain d'un accord dans une tonalité : « IV », « vi », « bVII », « V7 »… */
export function romanNumeral(c: Chord, key: Key): string {
  const deg = mod12(c.root - key.tonic);
  const base = (key.mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES)[deg]!;
  const m = /^([b#]?)(.*)$/.exec(base)!;
  const numeral = isMinorish(c.quality) ? m[2]!.toLowerCase() : m[2]!;
  return `${m[1]}${numeral}${QUALITY_MARK[c.quality]}`;
}

/** Remplace b / # par les vrais symboles typographiques. */
export function prettyAccidentals(s: string): string {
  return s.replace(/b(?=[IVX])/gi, '♭').replace(/#/g, '♯');
}
