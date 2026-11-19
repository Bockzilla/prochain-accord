import { chord, chordPitchClasses, isMinorish, type Chord, type ChordQuality } from './chords';
import { estimateKey, relativeKey, sameKey, type Key } from './keys';
import { mod12 } from './notes';
import { romanNumeral } from './roman';
import { scaleNotes, type Scale, type ScaleType } from './scales';

/** Fonction harmonique d'un accord dans une tonalité. */
export type HarmonicFunction = 'tonic' | 'subdominant' | 'dominant' | 'outside';

export interface DiatonicChord {
  chord: Chord;
  roman: string;
  degree: number; // 1..7
  fn: HarmonicFunction;
}

const MAJOR_TRIADS: [number, ChordQuality, HarmonicFunction][] = [
  [0, 'maj', 'tonic'],
  [2, 'min', 'subdominant'],
  [4, 'min', 'tonic'],
  [5, 'maj', 'subdominant'],
  [7, 'maj', 'dominant'],
  [9, 'min', 'tonic'],
  [11, 'dim', 'dominant'],
];

const MINOR_TRIADS: [number, ChordQuality, HarmonicFunction][] = [
  [0, 'min', 'tonic'],
  [2, 'dim', 'subdominant'],
  [3, 'maj', 'tonic'],
  [5, 'min', 'subdominant'],
  [7, 'min', 'dominant'],
  [8, 'maj', 'subdominant'],
  [10, 'maj', 'dominant'],
];

/** Les 7 accords de la tonalité, avec leur chiffre romain et leur fonction. */
export function diatonicTriads(key: Key): DiatonicChord[] {
  const table = key.mode === 'major' ? MAJOR_TRIADS : MINOR_TRIADS;
  return table.map(([iv, q, fn], i) => {
    const c = chord(key.tonic + iv, q);
    return { chord: c, roman: romanNumeral(c, key), degree: i + 1, fn };
  });
}

/**
 * Fonction d'un accord quelconque dans une tonalité. Le V majeur (et V7) d'une tonalité
 * mineure est la dominante « harmonique » : on le reconnaît aussi.
 */
export function harmonicFunction(c: Chord, key: Key): HarmonicFunction {
  const deg = mod12(c.root - key.tonic);
  if (deg === 7 && !isMinorish(c.quality)) return 'dominant';
  const d = diatonicTriads(key).find((x) => x.chord.root === mod12(c.root));
  if (!d) return 'outside';
  const sameColor = isMinorish(d.chord.quality) === isMinorish(c.quality) || c.quality === 'sus2' || c.quality === 'sus4';
  return sameColor ? d.fn : 'outside';
}

// ---------------------------------------------------------------------------
// Analyse d'une progression

export interface KeyCandidate {
  key: Key;
  /** Part relative de vraisemblance, 0..1 (la somme des candidats affichés ≤ 1). */
  likelihood: number;
}

export type Certainty = 'high' | 'medium' | 'low';

export interface ProgressionAnalysis {
  candidates: KeyCandidate[];
  best: Key;
  certainty: Certainty;
  /** Vrai si les deux meilleures tonalités sont relatives (mêmes notes, ex. Do majeur / La mineur). */
  relativeAmbiguity: boolean;
  chords: { chord: Chord; roman: string; fn: HarmonicFunction }[];
  scales: ScaleSuggestion[];
}

export interface ScaleSuggestion {
  scale: Scale;
  /** Clé i18n de la raison pédagogique (« scaleReason.<clé> »). */
  reason: 'pentatonicSafe' | 'fullScale' | 'bluesColor' | 'relativeSame' | 'majorPentaOverDominant' | 'mixolydianB7';
  /** Part des notes des accords contenues dans la gamme (1 = toutes). */
  coverage: number;
}

/**
 * Analyse prudente : on ne présente jamais une tonalité ambiguë comme une certitude.
 * Vraisemblances = exponentielle des corrélations de Krumhansl (température douce).
 */
export function analyzeProgression(chords: Chord[]): ProgressionAnalysis | null {
  if (chords.length === 0) return null;
  const est = estimateKey(chords.map((c) => ({ chord: c })), 16)!;
  const weights = est.ranking.map((r) => Math.exp(r.score * 8));
  const total = weights.reduce((x, y) => x + y, 0);
  let candidates = est.ranking.slice(0, 3).map((r, i) => ({ key: r.key, likelihood: weights[i]! / total }));
  const [a, b] = candidates;
  let relativeAmbiguity = false;
  let best = a!.key;
  if (b && sameKey(relativeKey(a!.key), b.key)) {
    // Tonalités relatives = mêmes notes. On ne tranche que sur un indice clair.
    const cue = modeCue(chords, a!.key, b.key);
    if (cue) {
      best = cue;
      if (!sameKey(cue, a!.key)) candidates = [b, a!, ...candidates.slice(2)];
    } else {
      relativeAmbiguity = true;
    }
  }
  const gap = candidates[0]!.likelihood - (candidates[1]?.likelihood ?? 0);
  let certainty: Certainty = gap > 0.4 ? 'high' : gap > 0.1 ? 'medium' : 'low';
  if (relativeAmbiguity) certainty = 'low';
  if (chords.length < 3 && certainty === 'high') certainty = 'medium';
  return {
    candidates,
    best,
    certainty,
    relativeAmbiguity,
    chords: chords.map((c) => ({ chord: c, roman: romanNumeral(c, best), fn: harmonicFunction(c, best) })),
    scales: suggestScales(chords, best),
  };
}

/**
 * Indice de mode entre deux tonalités relatives :
 * - la sensible du mineur (accord majeur sur le 5e degré du mineur, ex. Mi majeur en La mineur) ;
 * - commencer ET finir sur la même tonique.
 */
function modeCue(chords: Chord[], k1: Key, k2: Key): Key | null {
  const minor = k1.mode === 'minor' ? k1 : k2;
  const major = k1.mode === 'major' ? k1 : k2;
  const leading = chords.some((c) => c.root === mod12(minor.tonic + 7) && !isMinorish(c.quality));
  const first = chords[0]!;
  const last = chords[chords.length - 1]!;
  const framedBy = (k: Key) => chords.length >= 3 && first.root === k.tonic && last.root === k.tonic && isMinorish(first.quality) === (k.mode === 'minor');
  if (leading || framedBy(minor)) return minor;
  if (framedBy(major)) return major;
  return null;
}

function coverage(chords: Chord[], s: Scale): number {
  const pcs = new Set(scaleNotes(s));
  const all = chords.flatMap(chordPitchClasses);
  return all.filter((p) => pcs.has(p)).length / Math.max(1, all.length);
}

/** Gammes pour improviser sur une progression, de la plus sûre à la plus colorée. */
export function suggestScales(chords: Chord[], key: Key, style?: Style): ScaleSuggestion[] {
  const t = key.tonic;
  const minor = key.mode === 'minor';
  const list: Omit<ScaleSuggestion, 'coverage'>[] = [];
  const hasDominant7 = chords.some((c) => c.quality === '7');
  if (minor) {
    list.push({ scale: { tonic: t, type: 'minorPentatonic' }, reason: 'pentatonicSafe' });
    list.push({ scale: { tonic: t, type: 'naturalMinor' }, reason: 'fullScale' });
    list.push({ scale: { tonic: t, type: 'blues' }, reason: 'bluesColor' });
    list.push({ scale: { tonic: mod12(t + 3), type: 'majorPentatonic' }, reason: 'relativeSame' });
  } else if (style === 'blues' || (hasDominant7 && chords.filter((c) => c.quality === '7').length >= 2)) {
    // Blues majeur (I7 IV7 V7) : la pentatonique mineure de la tonique est LE son blues,
    // la majeure sonne plus « country ».
    list.push({ scale: { tonic: t, type: 'minorPentatonic' }, reason: 'bluesColor' });
    list.push({ scale: { tonic: t, type: 'blues' }, reason: 'bluesColor' });
    list.push({ scale: { tonic: t, type: 'majorPentatonic' }, reason: 'majorPentaOverDominant' });
    list.push({ scale: { tonic: t, type: 'mixolydian' }, reason: 'mixolydianB7' });
  } else {
    // Un accord contenant la ♭7 de la tonique (♭VII, I7…) appelle le mixolydien plutôt que le majeur.
    const flat7 = mod12(t + 10);
    const usesFlat7 = chords.some((c) => chordPitchClasses(c).includes(flat7));
    list.push({ scale: { tonic: t, type: 'majorPentatonic' }, reason: 'pentatonicSafe' });
    list.push(usesFlat7 ? { scale: { tonic: t, type: 'mixolydian' }, reason: 'fullScale' } : { scale: { tonic: t, type: 'major' }, reason: 'fullScale' });
    list.push({ scale: { tonic: mod12(t + 9), type: 'minorPentatonic' }, reason: 'relativeSame' });
    if (style === 'rock') list.push({ scale: { tonic: t, type: 'minorPentatonic' }, reason: 'bluesColor' });
  }
  return list.map((x) => ({ ...x, coverage: coverage(chords, x.scale) }));
}

// ---------------------------------------------------------------------------
// Progressions par style (formules génériques de la musique populaire, transposées par calcul)

export type Style = 'blues' | 'rock' | 'folk' | 'country';
export const STYLES: Style[] = ['blues', 'rock', 'folk', 'country'];

export interface ProgressionTemplate {
  id: string;
  style: Style;
  mode: Key['mode'];
  /** Une entrée par mesure : [intervalle depuis la tonique, qualité]. */
  bars: [number, ChordQuality][];
}

export const PROGRESSIONS: ProgressionTemplate[] = [
  { id: 'blues12', style: 'blues', mode: 'major', bars: [[0, '7'], [0, '7'], [0, '7'], [0, '7'], [5, '7'], [5, '7'], [0, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7'], [7, '7']] },
  { id: 'blues12quick', style: 'blues', mode: 'major', bars: [[0, '7'], [5, '7'], [0, '7'], [0, '7'], [5, '7'], [5, '7'], [0, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7'], [7, '7']] },
  { id: 'minorBlues', style: 'blues', mode: 'minor', bars: [[0, 'm7'], [0, 'm7'], [0, 'm7'], [0, 'm7'], [5, 'm7'], [5, 'm7'], [0, 'm7'], [0, 'm7'], [8, '7'], [7, '7'], [0, 'm7'], [7, '7']] },
  { id: 'rockI_bVII_IV', style: 'rock', mode: 'major', bars: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']] },
  { id: 'rockI_IV_V', style: 'rock', mode: 'major', bars: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [5, 'maj']] },
  { id: 'rockMinor', style: 'rock', mode: 'minor', bars: [[0, 'min'], [8, 'maj'], [10, 'maj'], [0, 'min']] },
  { id: 'folkI_V_vi_IV', style: 'folk', mode: 'major', bars: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
  { id: 'folkvi_IV_I_V', style: 'folk', mode: 'major', bars: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
  { id: 'folkMinor', style: 'folk', mode: 'minor', bars: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']] },
  { id: 'countryI_IV_V', style: 'country', mode: 'major', bars: [[0, 'maj'], [0, 'maj'], [5, 'maj'], [5, 'maj'], [7, 'maj'], [7, 'maj'], [0, 'maj'], [0, 'maj']] },
  { id: 'countryI_V7', style: 'country', mode: 'major', bars: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, '7']] },
];

/** Transpose un modèle dans une tonique donnée (le mode vient du modèle). */
export function realizeProgression(p: ProgressionTemplate, tonic: number): { key: Key; chords: Chord[] } {
  return { key: { tonic: mod12(tonic), mode: p.mode }, chords: p.bars.map(([iv, q]) => chord(tonic + iv, q)) };
}

export function progressionsFor(style: Style): ProgressionTemplate[] {
  return PROGRESSIONS.filter((p) => p.style === style);
}

export const scaleTypeLabelKey = (t: ScaleType) => `scale.${t}`;
