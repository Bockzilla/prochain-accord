import type { Barre, Fret } from './model';

export interface FingerAssignment {
  fingers: number[];
  barre: Barre | null;
}

/**
 * Attribue les doigts (1..4) à un doigté. Retourne null s'il faut plus de 4 doigts.
 * Règle : si plus de 4 cordes sont appuyées, l'index fait un barré sur la case la plus basse
 * (valable seulement si aucune corde entre les extrémités du barré n'est à vide ou muette).
 * Les notes restantes sont attribuées dans l'ordre (case, puis corde grave → aiguë).
 */
export function assignFingers(frets: Fret[]): FingerAssignment | null {
  const fingers = frets.map(() => 0);
  const pressed = frets
    .map((f, i) => ({ f, i }))
    .filter((x): x is { f: number; i: number } => x.f !== null && x.f > 0);
  if (pressed.length === 0) return { fingers, barre: null };

  const minFret = Math.min(...pressed.map((p) => p.f));
  let barre: Barre | null = null;
  let remaining = pressed;

  if (pressed.length > 4) {
    const atMin = pressed.filter((p) => p.f === minFret).map((p) => p.i);
    const from = Math.min(...atMin);
    const to = Math.max(...atMin);
    let valid = atMin.length >= 2;
    for (let s = from; s <= to && valid; s++) {
      const f = frets[s];
      if (f === null || f === undefined || f < minFret) valid = false;
    }
    if (!valid) return null;
    barre = { fret: minFret, fromString: from, toString: to };
    for (const s of atMin) fingers[s] = 1;
    remaining = pressed.filter((p) => p.f !== minFret);
  }

  const sorted = [...remaining].sort((a, b) => a.f - b.f || a.i - b.i);
  let next = barre ? 2 : 1;
  for (const p of sorted) {
    if (next > 4) return null;
    fingers[p.i] = next++;
  }
  return { fingers, barre };
}
