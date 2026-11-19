import { chordPitchClasses, type Chord } from './chords';
import { mod12, type PitchClass, type Spelling } from './notes';

export type Mode = 'major' | 'minor';

export interface Key {
  tonic: PitchClass;
  mode: Mode;
}

/** Profils de Krumhansl-Kessler (1982), index 0 = tonique. */
export const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function sameKey(a: Key | null, b: Key | null): boolean {
  return !!a && !!b && a.tonic === b.tonic && a.mode === b.mode;
}

export function relativeKey(k: Key): Key {
  return k.mode === 'major'
    ? { tonic: mod12(k.tonic + 9), mode: 'minor' }
    : { tonic: mod12(k.tonic + 3), mode: 'major' };
}

export function scalePitchClasses(k: Key): PitchClass[] {
  const s = k.mode === 'major' ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
  return s.map((i) => mod12(k.tonic + i));
}

/** Tonalités qui s'écrivent avec des bémols (Fa, Si♭, Mi♭, La♭, Ré♭ majeurs et leurs relatifs). */
export function keySpelling(k: Key | null): Spelling {
  if (!k) return 'sharp';
  const majorTonic = k.mode === 'major' ? k.tonic : mod12(k.tonic + 3);
  return [5, 10, 3, 8, 1].includes(majorTonic) ? 'flat' : 'sharp';
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]! - ma;
    const y = b[i]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

export interface KeyEstimate {
  key: Key;
  score: number;
  /** Écart avec la 2e meilleure tonalité (0 = ambigu). */
  margin: number;
  ranking: { key: Key; score: number }[];
}

export interface WeightedChord {
  chord: Chord;
  /** Durée relative (facultatif, 1 par défaut). */
  weight?: number;
}

/**
 * Estime la tonalité à partir des 4 à 8 derniers accords.
 * Histogramme des notes pondéré par récence (les plus récents comptent plus)
 * et fondamentale renforcée, puis corrélation avec les 24 profils.
 */
export function estimateKey(history: WeightedChord[], maxChords = 8): KeyEstimate | null {
  const recent = history.slice(-maxChords);
  if (recent.length === 0) return null;
  const hist = new Array<number>(12).fill(0);
  recent.forEach((h, i) => {
    const age = recent.length - 1 - i;
    const w = (h.weight ?? 1) * 0.88 ** age;
    for (const pc of chordPitchClasses(h.chord)) hist[pc]! += w;
    hist[h.chord.root]! += 0.5 * w;
  });
  // Petit bonus « tonique » pour la fondamentale du premier accord de la fenêtre :
  // les progressions commencent souvent sur la tonique.
  hist[recent[0]!.chord.root]! += 0.3;

  const ranking: { key: Key; score: number }[] = [];
  for (let t = 0; t < 12; t++) {
    for (const mode of ['major', 'minor'] as Mode[]) {
      const prof = mode === 'major' ? KK_MAJOR : KK_MINOR;
      const rotated = hist.map((_, pc) => prof[mod12(pc - t)]!);
      ranking.push({ key: { tonic: t, mode }, score: pearson(hist, rotated) });
    }
  }
  ranking.sort((a, b) => b.score - a.score);
  const best = ranking[0]!;
  return { key: best.key, score: best.score, margin: best.score - ranking[1]!.score, ranking };
}
