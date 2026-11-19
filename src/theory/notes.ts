/**
 * Notes et hauteurs — module PUR (aucune dépendance audio ni UI).
 * Une « classe de hauteur » (pitch class) est un entier 0..11, 0 = Do/C.
 */
export type PitchClass = number;

export const mod12 = (n: number): PitchClass => ((n % 12) + 12) % 12;

/** Lettre (0 = C … 6 = B) + altération (-1 = bémol, 0, +1 = dièse). */
export interface SpelledNote {
  letter: number;
  accidental: -1 | 0 | 1;
}

const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

const SHARP_SPELLING: SpelledNote[] = [
  { letter: 0, accidental: 0 },
  { letter: 0, accidental: 1 },
  { letter: 1, accidental: 0 },
  { letter: 1, accidental: 1 },
  { letter: 2, accidental: 0 },
  { letter: 3, accidental: 0 },
  { letter: 3, accidental: 1 },
  { letter: 4, accidental: 0 },
  { letter: 4, accidental: 1 },
  { letter: 5, accidental: 0 },
  { letter: 5, accidental: 1 },
  { letter: 6, accidental: 0 },
];

const FLAT_SPELLING: SpelledNote[] = [
  { letter: 0, accidental: 0 },
  { letter: 1, accidental: -1 },
  { letter: 1, accidental: 0 },
  { letter: 2, accidental: -1 },
  { letter: 2, accidental: 0 },
  { letter: 3, accidental: 0 },
  { letter: 4, accidental: -1 },
  { letter: 4, accidental: 0 },
  { letter: 5, accidental: -1 },
  { letter: 5, accidental: 0 },
  { letter: 6, accidental: -1 },
  { letter: 6, accidental: 0 },
];

export type Spelling = 'sharp' | 'flat';

export function spell(pc: PitchClass, spelling: Spelling = 'sharp'): SpelledNote {
  return (spelling === 'flat' ? FLAT_SPELLING : SHARP_SPELLING)[mod12(pc)]!;
}

export function spelledToPc(n: SpelledNote): PitchClass {
  return mod12(LETTER_PC[n.letter]! + n.accidental);
}

/** Fréquence d'une note MIDI (A4 = 69). */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Note MIDI (non arrondie) d'une fréquence. */
export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}
