import type { Style } from '../theory/harmony';

/**
 * Motifs rythmiques ORIGINAUX, décrits temps par temps — module PUR.
 * Ils s'adaptent à n'importe quelle mesure : temps 1 = appui, temps pairs/impairs = contretemps.
 * Améliorer le réalisme plus tard = remplacer ces motifs ou les sons, sans toucher au reste.
 */
export type Part = 'kick' | 'snare' | 'hat' | 'bass' | 'chord';
export type BassDegree = '1' | '3' | '5' | '6' | 'b7' | '8';

export interface Hit {
  /** Position dans le temps : 0 = sur le temps, 0.5 = croche (décalée si swing). */
  at: number;
  part: Part;
  vel: number;
  /** Durée en temps. */
  len: number;
  bass?: BassDegree;
}

export interface StyleDef {
  /** Proportion de la 1re croche (0.5 = droit, 0.667 = shuffle ternaire). */
  swing: number;
  /** Accord joué en « power chord » (rock) ou plein. */
  power: boolean;
  /** Décalage entre cordes pour imiter un grattage (s). */
  strum: number;
}

export const STYLE_DEFS: Record<Style, StyleDef> = {
  blues: { swing: 2 / 3, power: false, strum: 0.008 },
  rock: { swing: 0.5, power: true, strum: 0.004 },
  folk: { swing: 0.5, power: false, strum: 0.014 },
  country: { swing: 0.55, power: false, strum: 0.01 },
};

const BLUES_BASS: BassDegree[] = ['1', '5', '6', '5'];

/** Les frappes d'un temps donné. `lastBarOfLoop` déclenche un petit roulement de fin de boucle. */
export function hitsForBeat(style: Style, beat: number, beatsPerBar: number, lastBarOfLoop: boolean): Hit[] {
  const down = beat === 0;
  const back = beat % 2 === 1;
  const mid = !down && !back; // temps 3 en 4/4
  const lastBeat = beat === beatsPerBar - 1;
  const h: Hit[] = [];
  const fill = lastBarOfLoop && lastBeat && beatsPerBar > 1;

  // --- Batterie, commune avec des nuances par style ---
  const hatVel = style === 'folk' ? 0.25 : 0.45;
  if (!fill) {
    h.push({ at: 0, part: 'hat', vel: hatVel, len: 0.1 });
    h.push({ at: 0.5, part: 'hat', vel: hatVel * 0.7, len: 0.1 });
  }
  if (down || mid) h.push({ at: 0, part: 'kick', vel: down ? 1 : 0.8, len: 0.25 });
  if (style === 'rock' && mid) h.push({ at: 0.5, part: 'kick', vel: 0.6, len: 0.25 });
  if (back && !fill) h.push({ at: 0, part: 'snare', vel: style === 'folk' ? 0.4 : 0.8, len: 0.2 });
  if (fill) {
    h.push({ at: 0, part: 'snare', vel: 0.6, len: 0.15 }, { at: 0.5, part: 'snare', vel: 0.75, len: 0.15 });
    if (style === 'rock') h.push({ at: 0.75, part: 'snare', vel: 0.9, len: 0.15 });
  }

  // --- Basse et accords ---
  switch (style) {
    case 'blues': {
      // Basse « boogie » en croches ternaires : 1-5-6-5, chaque note doublée.
      const d = BLUES_BASS[beat % BLUES_BASS.length]!;
      h.push({ at: 0, part: 'bass', vel: 0.85, len: 0.45, bass: d }, { at: 0.5, part: 'bass', vel: 0.6, len: 0.4, bass: d });
      if (back) h.push({ at: 0.5, part: 'chord', vel: 0.5, len: 0.3 });
      break;
    }
    case 'rock':
      h.push({ at: 0, part: 'bass', vel: 0.85, len: 0.45, bass: '1' }, { at: 0.5, part: 'bass', vel: 0.7, len: 0.45, bass: '1' });
      h.push({ at: 0, part: 'chord', vel: 0.55, len: 0.45 }, { at: 0.5, part: 'chord', vel: 0.4, len: 0.4 });
      break;
    case 'folk':
      // Grattage bas / bas-haut / haut / bas-haut.
      if (down) h.push({ at: 0, part: 'bass', vel: 0.75, len: 1.5, bass: '1' });
      if (mid) h.push({ at: 0, part: 'bass', vel: 0.65, len: 1.5, bass: '5' });
      if (down) h.push({ at: 0, part: 'chord', vel: 0.6, len: 1 });
      else if (back) h.push({ at: 0, part: 'chord', vel: 0.5, len: 0.5 }, { at: 0.5, part: 'chord', vel: 0.35, len: 0.5 });
      else h.push({ at: 0.5, part: 'chord', vel: 0.4, len: 0.5 });
      break;
    case 'country':
      // « Boum-tchik » : basse alternée fondamentale / quinte, accord bref sur les contretemps.
      if (down || mid) h.push({ at: 0, part: 'bass', vel: 0.85, len: 0.8, bass: down ? '1' : '5' });
      if (back) h.push({ at: 0, part: 'chord', vel: 0.55, len: 0.3 });
      if (lastBeat && lastBarOfLoop) h.push({ at: 0.5, part: 'bass', vel: 0.6, len: 0.4, bass: '6' });
      break;
  }
  return h;
}
