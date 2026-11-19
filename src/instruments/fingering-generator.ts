import { chordPitchClasses, type Chord } from '../theory/chords';
import { mod12 } from '../theory/notes';
import { assignFingers } from './fingers';
import type { Fret, FrettedInstrument } from './model';
import { fretSpan, rootInBass, soundingMidi, validateFingering } from './validate';

export interface GeneratedShape {
  frets: Fret[];
  score: number;
}

/**
 * Générateur algorithmique de secours.
 * Recherche exhaustive dans une fenêtre de cases [start, start + span - 1] (+ cordes à vide),
 * avec contraintes de jouabilité ; le score favorise la fondamentale à la basse,
 * peu de doigts, peu de cordes muettes, et des cordes muettes seulement côté grave.
 */
export function generateInWindow(inst: FrettedInstrument, c: Chord, start: number): GeneratedShape[] {
  const want = new Set(chordPitchClasses(c));
  const n = inst.tuning.length;
  const options: Fret[][] = inst.tuning.map((open) => {
    const opts: Fret[] = [null];
    // Cordes à vide seulement près du sillet (sinon formes difficiles à lire et à jouer).
    if (want.has(mod12(open)) && start <= 4) opts.push(0);
    const lo = Math.max(1, start);
    const hi = Math.min(inst.frets, start + inst.maxSpan - 1);
    for (let f = lo; f <= hi; f++) if (want.has(mod12(open + f))) opts.push(f);
    return opts;
  });

  const results: GeneratedShape[] = [];
  const cur: Fret[] = new Array(n).fill(null);
  const recurse = (s: number) => {
    if (s === n) {
      const frets = [...cur];
      // Cordes muettes uniquement du côté grave (pas de corde étouffée au milieu).
      const firstSounding = frets.findIndex((f) => f !== null);
      if (firstSounding < 0 || frets.slice(firstSounding).some((f) => f === null)) return;
      if (!validateFingering(inst, c, frets).ok) return;
      results.push({ frets, score: scoreShape(inst, c, frets) });
      return;
    }
    for (const o of options[s]!) {
      cur[s] = o;
      recurse(s + 1);
    }
  };
  recurse(0);
  return results.sort((a, b) => b.score - a.score);
}

export function scoreShape(inst: FrettedInstrument, c: Chord, frets: Fret[]): number {
  let s = 0;
  if (rootInBass(inst, c, frets)) s += 6;
  const muted = frets.filter((f) => f === null).length;
  s -= muted * 1.2;
  const fingers = assignFingers(frets);
  const used = fingers ? new Set(fingers.fingers.filter((x) => x > 0)).size : 9;
  s -= used * 0.6;
  s -= fretSpan(frets) * 0.3;
  const pressed = frets.filter((f): f is number => f !== null && f > 0);
  const low = pressed.length ? Math.min(...pressed) : 0;
  s -= low * 0.05;
  // Doublures : plus de cordes qui sonnent = son plus plein.
  s += soundingMidi(inst, frets).length * 0.4;
  return s;
}

/**
 * Meilleur doigté de chaque fenêtre de 0 à maxStart (un par position du manche).
 * Fondamentale à la basse exigée ; repli sans cette contrainte si rien n'est trouvé.
 */
export function generatePositions(inst: FrettedInstrument, c: Chord, maxStart = 12): Fret[][] {
  const pick = (requireRoot: boolean) => {
    const out: Fret[][] = [];
    const seen = new Set<string>();
    for (let start = 0; start <= maxStart; start++) {
      const best = generateInWindow(inst, c, start).find((g) => !requireRoot || rootInBass(inst, c, g.frets));
      if (!best) continue;
      const key = best.frets.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(best.frets);
    }
    return out;
  };
  if (!inst.rootInBass) return pick(false);
  const strict = pick(true);
  return strict.length >= 2 ? strict : [...strict, ...pick(false)];
}
