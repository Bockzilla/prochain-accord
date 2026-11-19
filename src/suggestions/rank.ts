import { chordId, commonTones, sameChord, type Chord } from '../theory/chords';
import { estimateKey, type Key } from '../theory/keys';
import { mod12 } from '../theory/notes';
import { buildCandidates, type Candidate, type Category, type GraphOptions } from './graph';

export interface Suggestion extends Candidate {
  score: number;
}

export const CATEGORY_ORDER: Category[] = ['safe', 'colorful', 'bold'];
const CATEGORY_BASE: Record<Category, number> = { safe: 3, colorful: 2, bold: 1 };

/** Score contextuel d'un enchaînement current → candidat. */
function transitionScore(current: Chord, c: Candidate, key: Key, recent: Chord[]): number {
  let s = CATEGORY_BASE[c.category];
  const motion = mod12(c.chord.root - current.root);
  if (motion === 5) s += 1.0; // quinte descendante (V → I, ii → V…)
  if (motion === 7) s += 0.4; // quinte montante
  if (motion === 1 || motion === 2 || motion === 10 || motion === 11) s += 0.25; // mouvement conjoint
  s += 0.25 * commonTones(current, c.chord);
  // Dominante → tonique : la résolution la plus attendue.
  const dominantRoot = mod12(key.tonic + 7);
  if (current.root === dominantRoot && c.chord.root === key.tonic) s += 1.5;
  // Cadence rompue : V → vi (majeur) ou V → VI (mineur).
  if (current.root === dominantRoot && c.chord.root === mod12(key.tonic + (key.mode === 'major' ? 9 : 8))) s += 0.8;
  // Après une dominante secondaire, l'accord visé est très probable.
  if (c.reason === 'resolution') s += 1.2;
  // Le relatif est l'enchaînement le plus courant (C ↔ Am).
  if (c.reason === 'relativeMinor' || c.reason === 'relativeMajor') s += 0.4;
  // Éviter de suggérer ce qu'on vient de jouer.
  if (recent.some((r) => sameChord(r, c.chord))) s -= 0.6;
  return s;
}

export interface SuggestOptions extends GraphOptions {
  count: number;
  /** Tonalité imposée ; sinon estimée sur l'historique. */
  key?: Key;
}

export interface SuggestResult {
  key: Key;
  keyConfidence: number;
  suggestions: Suggestion[];
}

/** Tonalité par défaut quand l'historique est vide : l'accord actuel comme tonique. */
export function keyFromChord(c: Chord): Key {
  return { tonic: c.root, mode: c.quality === 'min' || c.quality === 'm7' ? 'minor' : 'major' };
}

/**
 * Suggère les prochains accords, classés de « sûr » à « audacieux ».
 * `history` : accords joués, du plus ancien au plus récent (le dernier = accord actuel).
 */
export function suggestNext(history: Chord[], opts: SuggestOptions): SuggestResult | null {
  const current = history[history.length - 1];
  if (!current) return null;
  let key = opts.key;
  let keyConfidence = 1;
  if (!key) {
    const est = history.length >= 2 ? estimateKey(history.map((c) => ({ chord: c }))) : null;
    key = est ? est.key : keyFromChord(current);
    keyConfidence = est ? Math.max(0, Math.min(1, est.margin * 10)) : 0.3;
  }
  const recent = history.slice(-3);
  const candidates = buildCandidates(current, key, opts);

  // Résolution d'une dominante secondaire : si l'accord actuel est V/x, proposer x.
  for (const deg of [2, 4, 5, 7, 9]) {
    const target = mod12(key.tonic + deg);
    if (mod12(current.root - target) === 7 && current.quality !== 'min' && current.quality !== 'm7') {
      const fromDiatonic = candidates.find((c) => c.chord.root === target && c.category === 'safe');
      if (fromDiatonic) candidates.push({ ...fromDiatonic, reason: 'resolution' });
    }
  }

  // Dédoublonnage : on garde la meilleure entrée pour chaque accord.
  const best = new Map<string, Suggestion>();
  for (const c of candidates) {
    if (sameChord(c.chord, current)) continue;
    const s: Suggestion = { ...c, score: transitionScore(current, c, key, recent) };
    const id = chordId(c.chord);
    const prev = best.get(id);
    if (!prev || s.score > prev.score) best.set(id, s);
  }
  const all = [...best.values()];

  // Sélection équilibrée : environ moitié sûrs, puis colorés, puis audacieux.
  const n = opts.count;
  const quota: Record<Category, number> = {
    safe: Math.ceil(n / 2),
    colorful: Math.max(1, Math.floor(n / 3)),
    bold: Math.max(1, n - Math.ceil(n / 2) - Math.max(1, Math.floor(n / 3))),
  };
  const picked: Suggestion[] = [];
  for (const cat of CATEGORY_ORDER) {
    const pool = all.filter((s) => s.category === cat).sort((a, b) => b.score - a.score);
    picked.push(...pool.slice(0, quota[cat]));
  }
  // Compléter si une catégorie manquait de candidats.
  if (picked.length < n) {
    const rest = all
      .filter((s) => !picked.includes(s))
      .sort((a, b) => b.score - a.score)
      .slice(0, n - picked.length);
    picked.push(...rest);
  }
  picked.sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.score - a.score,
  );
  return { key, keyConfidence, suggestions: picked.slice(0, n) };
}
