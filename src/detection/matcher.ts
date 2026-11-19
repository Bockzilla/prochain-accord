import { chord, chordPitchClasses, type Chord, type ChordQuality } from '../theory/chords';
import { mod12 } from '../theory/notes';

/** Gabarit d'accord : 1 sur chaque note, fondamentale légèrement renforcée. */
export function chordTemplate(c: Chord): Float64Array {
  const t = new Float64Array(12);
  for (const pc of chordPitchClasses(c)) t[pc] = 1;
  t[mod12(c.root)] = 1.15;
  return t;
}

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 12; i++) {
    d += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

export interface Match {
  chord: Chord;
  score: number;
}

const templateCache = new Map<string, { chord: Chord; t: Float64Array }[]>();

function templates(qualities: ChordQuality[]) {
  const key = qualities.join(',');
  let list = templateCache.get(key);
  if (!list) {
    list = [];
    for (let r = 0; r < 12; r++) for (const q of qualities) list.push({ chord: chord(r, q), t: chordTemplate(chord(r, q)) });
    templateCache.set(key, list);
  }
  return list;
}

/**
 * Compare le chromagramme à tous les gabarits (similarité cosinus).
 * Les accords à 4 sons reçoivent une petite pénalité : à score égal, on préfère la triade.
 * Un petit bonus va aux accords dont la fondamentale est la note la plus grave entendue.
 */
export function matchChord(chroma: ArrayLike<number>, qualities: ChordQuality[], bass = -1): Match[] {
  const out = templates(qualities).map(({ chord: c, t }) => {
    let s = cosine(chroma, t);
    if (chordPitchClasses(c).length === 4) s -= 0.02;
    if (c.quality === 'sus2' || c.quality === 'sus4') s -= 0.015;
    if (bass >= 0 && mod12(c.root) === bass) s += 0.03; // fondamentale à la basse
    return { chord: c, score: s };
  });
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Indice de confiance 0..1 : combine la ressemblance absolue (cosinus)
 * et l'avance sur le 2e candidat (accord ambigu = confiance faible).
 */
export function confidence(matches: Match[]): number {
  const [a, b] = matches;
  if (!a) return 0;
  const abs = Math.max(0, Math.min(1, (a.score - 0.6) / 0.35));
  const margin = Math.max(0, Math.min(1, (a.score - (b?.score ?? 0)) / 0.08));
  return abs * (0.4 + 0.6 * margin);
}
