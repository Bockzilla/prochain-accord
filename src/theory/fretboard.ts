import { mod12, type PitchClass } from './notes';
import { intervalName, scaleNotes, SCALE_INTERVALS, type Scale } from './scales';

/**
 * Notes d'une gamme sur un manche — PUR, valable pour n'importe quel accordage.
 * `tuning` = hauteurs MIDI des cordes à vide, de la plus grave à la plus aiguë.
 */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

export interface NeckNote {
  string: number;
  fret: number;
  midi: number;
  pc: PitchClass;
  /** « 1 », « ♭3 », « 5 »… */
  interval: string;
  isRoot: boolean;
}

export function noteAt(tuning: readonly number[], s: number, fret: number, tonic: PitchClass): NeckNote {
  const midi = tuning[s]! + fret;
  const pc = mod12(midi);
  return { string: s, fret, midi, pc, interval: intervalName(pc - tonic), isRoot: pc === mod12(tonic) };
}

/** Toutes les notes de la gamme entre les cases 0 et maxFret. */
export function scaleOnNeck(scale: Scale, tuning: readonly number[] = STANDARD_TUNING, maxFret = 15): NeckNote[] {
  const pcs = new Set(scaleNotes(scale));
  const out: NeckNote[] = [];
  tuning.forEach((_, s) => {
    for (let f = 0; f <= maxFret; f++) {
      const n = noteAt(tuning, s, f, scale.tonic);
      if (pcs.has(n.pc)) out.push(n);
    }
  });
  return out;
}

/**
 * Les cinq positions (« boîtes ») d'une gamme pentatonique, calculées et non mémorisées :
 * la position p commence sur la p-ième note de la gamme, sur la corde la plus grave,
 * puis on monte note après note dans la gamme en prenant 2 notes par corde.
 * Pour une gamme à 6 notes (blues), la note ajoutée (♭5) est insérée si elle tombe dans la boîte.
 */
export function pentatonicPositions(scale: Scale, tuning: readonly number[] = STANDARD_TUNING, maxFret = 17): NeckNote[][] {
  const pentaType = scale.type === 'majorPentatonic' ? 'majorPentatonic' : 'minorPentatonic';
  const steps = SCALE_INTERVALS[pentaType];
  const positions: NeckNote[][] = [];
  for (let p = 0; p < 5; p++) {
    // Case de départ : plus basse case ≥ 0 de la p-ième note sur la corde grave.
    const startPc = mod12(scale.tonic + steps[p]!);
    let startFret = mod12(startPc - tuning[0]!);
    let box = buildBox(scale.tonic, steps, p, tuning, startFret);
    // Si la boîte passe sous le sillet (corde de Si), on la remonte d'une octave.
    if (box.some((n) => n.fret < 0)) {
      startFret += 12;
      box = buildBox(scale.tonic, steps, p, tuning, startFret);
    }
    // Si elle dépasse le manche affiché, on la descend d'une octave quand c'est possible.
    if (box.some((n) => n.fret > maxFret) && startFret >= 12) {
      box = buildBox(scale.tonic, steps, p, tuning, startFret - 12);
    }
    if (scale.type === 'blues') box = addBlueNotes(box, scale.tonic, tuning);
    positions.push(box);
  }
  return positions;
}

function buildBox(tonic: number, steps: readonly number[], p: number, tuning: readonly number[], startFret: number): NeckNote[] {
  const box: NeckNote[] = [];
  let midi = tuning[0]! + startFret;
  let degree = p;
  for (let s = 0; s < tuning.length; s++) {
    for (let k = 0; k < 2; k++) {
      if (!(s === 0 && k === 0)) {
        // Note suivante de la gamme, au-dessus de la précédente.
        const next = degree + 1;
        const octave = Math.floor(next / steps.length);
        const cur = steps[degree % steps.length]! + 12 * Math.floor(degree / steps.length);
        const nxt = steps[next % steps.length]! + 12 * octave;
        midi += nxt - cur;
        degree = next;
      }
      const fret = midi - tuning[s]!;
      box.push({ string: s, fret, midi, pc: mod12(midi), interval: intervalName(midi - tonic), isRoot: mod12(midi) === mod12(tonic) });
    }
  }
  return box;
}

/** Ajoute la « blue note » (♭5) sur chaque corde si elle tombe entre les cases de la boîte. */
function addBlueNotes(box: NeckNote[], tonic: number, tuning: readonly number[]): NeckNote[] {
  const blue = mod12(tonic + 6);
  const out = [...box];
  for (let s = 0; s < tuning.length; s++) {
    const frets = box.filter((n) => n.string === s).map((n) => n.fret);
    const lo = Math.min(...frets);
    const hi = Math.max(...frets);
    for (let f = lo; f <= hi; f++) {
      const n = noteAt(tuning, s, f, tonic);
      if (n.pc === blue) out.push(n);
    }
  }
  return out.sort((a, b) => a.string - b.string || a.fret - b.fret);
}

/** Étendue (en cases) d'une position, de la plus basse à la plus haute. */
export function positionRange(box: NeckNote[]): { from: number; to: number } {
  const frets = box.map((n) => n.fret);
  return { from: Math.min(...frets), to: Math.max(...frets) };
}
