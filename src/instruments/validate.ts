import { chordPitchClasses, type Chord } from '../theory/chords';
import { mod12 } from '../theory/notes';
import { assignFingers } from './fingers';
import type { Fret, FrettedInstrument } from './model';

export function soundingMidi(inst: FrettedInstrument, frets: Fret[]): number[] {
  const out: number[] = [];
  frets.forEach((f, i) => {
    if (f !== null) out.push(inst.tuning[i]! + f);
  });
  return out;
}

export function fretSpan(frets: Fret[]): number {
  const pressed = frets.filter((f): f is number => f !== null && f > 0);
  if (pressed.length === 0) return 0;
  return Math.max(...pressed) - Math.min(...pressed) + 1;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Vérifie qu'un doigté produit EXACTEMENT les notes de l'accord et qu'il est jouable. */
export function validateFingering(inst: FrettedInstrument, c: Chord, frets: Fret[]): ValidationResult {
  const errors: string[] = [];
  if (frets.length !== inst.tuning.length) errors.push('nombre de cordes');
  const midi = soundingMidi(inst, frets);
  const got = new Set(midi.map(mod12));
  const want = new Set(chordPitchClasses(c));
  for (const p of want) if (!got.has(p)) errors.push(`note manquante ${p}`);
  for (const p of got) if (!want.has(p)) errors.push(`note en trop ${p}`);
  if (midi.length < Math.min(inst.minSounding, inst.tuning.length)) errors.push('trop peu de cordes');
  if (frets.some((f) => f !== null && (f < 0 || f > inst.frets))) errors.push('case hors manche');
  if (fretSpan(frets) > inst.maxSpan) errors.push('écart trop grand');
  if (!assignFingers(frets)) errors.push('plus de 4 doigts');
  return { ok: errors.length === 0, errors };
}

/** La note la plus grave est-elle la fondamentale ? */
export function rootInBass(inst: FrettedInstrument, c: Chord, frets: Fret[]): boolean {
  const midi = soundingMidi(inst, frets);
  if (midi.length === 0) return false;
  return mod12(Math.min(...midi)) === mod12(c.root);
}
