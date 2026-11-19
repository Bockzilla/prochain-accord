import { mod12, type PitchClass } from './notes';

/**
 * Gammes — module PUR. Toutes les tonalités sont CALCULÉES par transposition
 * d'une liste d'intervalles : rien n'est écrit à la main tonalité par tonalité.
 */
export type ScaleType = 'minorPentatonic' | 'majorPentatonic' | 'major' | 'naturalMinor' | 'blues' | 'mixolydian';

export const SCALE_TYPES: ScaleType[] = ['minorPentatonic', 'majorPentatonic', 'blues', 'naturalMinor', 'major', 'mixolydian'];

export const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** Nom d'intervalle depuis la fondamentale (identique dans les 3 langues). */
const INTERVAL_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

export function intervalName(semitones: number): string {
  return INTERVAL_NAMES[mod12(semitones)]!;
}

export interface Scale {
  tonic: PitchClass;
  type: ScaleType;
}

export function scaleNotes(s: Scale): PitchClass[] {
  return SCALE_INTERVALS[s.type].map((i) => mod12(s.tonic + i));
}

export function isPentatonic(t: ScaleType): boolean {
  return t === 'minorPentatonic' || t === 'majorPentatonic' || t === 'blues';
}

export function isMinorScale(t: ScaleType): boolean {
  return t === 'minorPentatonic' || t === 'blues' || t === 'naturalMinor';
}

/** Gamme « relative » : La mineur ↔ Do majeur (mêmes notes, autre centre). */
export function relativeScale(s: Scale): Scale | null {
  switch (s.type) {
    case 'minorPentatonic':
      return { tonic: mod12(s.tonic + 3), type: 'majorPentatonic' };
    case 'majorPentatonic':
      return { tonic: mod12(s.tonic + 9), type: 'minorPentatonic' };
    case 'naturalMinor':
      return { tonic: mod12(s.tonic + 3), type: 'major' };
    case 'major':
      return { tonic: mod12(s.tonic + 9), type: 'naturalMinor' };
    default:
      return null;
  }
}
