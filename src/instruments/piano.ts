import { QUALITY_INTERVALS, type Chord } from '../theory/chords';
import { mod12 } from '../theory/notes';

/** Clavier affiché : 2 octaves, Do3 (MIDI 48) à Si4 (MIDI 71). */
export const PIANO_LOW = 48;
export const PIANO_HIGH = 71;

export interface PianoVoicing {
  /** 0 = position fondamentale, 1 = 1er renversement, 2 = 2e… */
  inversion: number;
  midi: number[];
  root: number;
}

export function pianoVoicing(c: Chord, inversion: number): PianoVoicing {
  const intervals = QUALITY_INTERVALS[c.quality];
  const inv = ((inversion % intervals.length) + intervals.length) % intervals.length;
  const rootMidi = PIANO_LOW + mod12(c.root);
  let notes = intervals.map((i) => rootMidi + i);
  for (let k = 0; k < inv; k++) notes = [...notes.slice(1), notes[0]! + 12];
  while (Math.max(...notes) > PIANO_HIGH && Math.min(...notes) - 12 >= PIANO_LOW) notes = notes.map((n) => n - 12);
  return { inversion: inv, midi: notes, root: mod12(c.root) };
}

export function pianoInversions(c: Chord): PianoVoicing[] {
  return QUALITY_INTERVALS[c.quality].map((_, i) => pianoVoicing(c, i));
}
