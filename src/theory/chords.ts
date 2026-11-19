import { mod12, type PitchClass } from './notes';

export type ChordQuality = 'maj' | 'min' | '7' | 'maj7' | 'm7' | 'sus2' | 'sus4' | 'dim';

export const BASIC_QUALITIES: ChordQuality[] = ['maj', 'min'];
export const EXTENDED_QUALITIES: ChordQuality[] = ['7', 'maj7', 'm7', 'sus2', 'sus4'];
export const ALL_QUALITIES: ChordQuality[] = [...BASIC_QUALITIES, ...EXTENDED_QUALITIES];
/** Qualités affichables (théorie, doigtés) ; « dim » n'est pas détecté au micro. */
export const DISPLAY_QUALITIES: ChordQuality[] = [...ALL_QUALITIES, 'dim'];

/** Intervalles en demi-tons depuis la fondamentale. */
export const QUALITY_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

/** Suffixe affiché après le nom de la fondamentale (identique dans toutes les langues). */
export const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  '7': '7',
  maj7: 'maj7',
  m7: 'm7',
  sus2: 'sus2',
  sus4: 'sus4',
  dim: '°',
};

export interface Chord {
  root: PitchClass;
  quality: ChordQuality;
}

export function chord(root: PitchClass, quality: ChordQuality = 'maj'): Chord {
  return { root: mod12(root), quality };
}

export function chordPitchClasses(c: Chord): PitchClass[] {
  return QUALITY_INTERVALS[c.quality].map((i) => mod12(c.root + i));
}

export function chordId(c: Chord): string {
  return `${mod12(c.root)}:${c.quality}`;
}

export function sameChord(a: Chord | null | undefined, b: Chord | null | undefined): boolean {
  return !!a && !!b && mod12(a.root) === mod12(b.root) && a.quality === b.quality;
}

export function commonTones(a: Chord, b: Chord): number {
  const sa = new Set(chordPitchClasses(a));
  return chordPitchClasses(b).filter((p) => sa.has(p)).length;
}

/** Couleur de base : majeur-ish (maj, 7, maj7, sus) ou mineur-ish (min, m7). */
export function isMinorish(q: ChordQuality): boolean {
  return q === 'min' || q === 'm7' || q === 'dim';
}
