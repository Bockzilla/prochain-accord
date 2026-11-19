import { chord, type Chord, type ChordQuality, isMinorish } from '../theory/chords';
import type { Key } from '../theory/keys';
import { mod12 } from '../theory/notes';
import { romanNumeral } from '../theory/roman';

export type Category = 'safe' | 'colorful' | 'bold';

/** Raisons possibles — chaque clé correspond à une entrée i18n « reason.<clé> ». */
export type ReasonKey =
  | 'tonic'
  | 'diatonic'
  | 'dominant'
  | 'subdominant'
  | 'relativeMinor'
  | 'relativeMajor'
  | 'fifthDown'
  | 'resolution'
  | 'secondaryDominant'
  | 'borrowed'
  | 'chromaticMediant'
  | 'neapolitan';

export interface Candidate {
  chord: Chord;
  roman: string;
  category: Category;
  reason: ReasonKey;
  /** Paramètres de la raison (ex. accord visé par une dominante secondaire, en chiffre romain). */
  reasonTarget?: string;
}

export interface GraphOptions {
  /** Utiliser des accords de septième (V7, V7/x) si les types étendus sont activés. */
  sevenths: boolean;
}

const triad = (q: ChordQuality, sevenths: boolean): ChordQuality =>
  sevenths && q === 'maj' ? '7' : q;

/** Accords diatoniques de la tonalité (I ii iii IV V vi en majeur ; i III iv v/V VI VII en mineur). */
export function diatonicChords(key: Key): { chord: Chord; reason: ReasonKey }[] {
  const t = key.tonic;
  if (key.mode === 'major') {
    return [
      { chord: chord(t, 'maj'), reason: 'tonic' },
      { chord: chord(t + 2, 'min'), reason: 'diatonic' },
      { chord: chord(t + 4, 'min'), reason: 'diatonic' },
      { chord: chord(t + 5, 'maj'), reason: 'subdominant' },
      { chord: chord(t + 7, 'maj'), reason: 'dominant' },
      { chord: chord(t + 9, 'min'), reason: 'relativeMinor' },
    ];
  }
  return [
    { chord: chord(t, 'min'), reason: 'tonic' },
    { chord: chord(t + 3, 'maj'), reason: 'relativeMajor' },
    { chord: chord(t + 5, 'min'), reason: 'subdominant' },
    { chord: chord(t + 7, 'maj'), reason: 'dominant' }, // V de la mineure harmonique
    { chord: chord(t + 7, 'min'), reason: 'diatonic' },
    { chord: chord(t + 8, 'maj'), reason: 'diatonic' },
    { chord: chord(t + 10, 'maj'), reason: 'diatonic' },
  ];
}

/**
 * Construit tous les candidats « théoriques » pour la suite de `current` dans `key`.
 * Le classement (score) est fait dans rank.ts.
 */
export function buildCandidates(current: Chord, key: Key, opts: GraphOptions): Candidate[] {
  const out: Candidate[] = [];
  const add = (c: Chord, category: Category, reason: ReasonKey, reasonTarget?: string) =>
    out.push({ chord: c, roman: romanNumeral(c, key), category, reason, reasonTarget });

  // 1. Diatoniques — sûrs.
  for (const d of diatonicChords(key)) {
    const c = d.reason === 'dominant' ? chord(d.chord.root, triad('maj', opts.sevenths)) : d.chord;
    add(c, 'safe', d.reason);
  }

  // 2. Relatif majeur / mineur de l'accord actuel — sûr.
  if (current.quality === 'maj' || current.quality === '7' || current.quality === 'maj7') {
    add(chord(current.root + 9, 'min'), 'safe', 'relativeMinor');
  } else if (isMinorish(current.quality)) {
    add(chord(current.root + 3, 'maj'), 'safe', 'relativeMajor');
  }

  // 3. Cycle des quintes : la quinte descendante de l'accord actuel (mouvement le plus fort).
  const fifthDownRoot = mod12(current.root + 5);
  const diatonicMatch = diatonicChords(key).find((d) => d.chord.root === fifthDownRoot);
  const fifthQuality: ChordQuality = diatonicMatch
    ? diatonicMatch.chord.quality
    : isMinorish(current.quality) ? 'min' : 'maj';
  add(chord(fifthDownRoot, fifthQuality), diatonicMatch ? 'safe' : 'colorful', 'fifthDown');

  // 4. Dominantes secondaires V/x — colorées.
  const targets = key.mode === 'major' ? [2, 4, 5, 7, 9] : [3, 5, 8, 10];
  for (const deg of targets) {
    const targetRoot = mod12(key.tonic + deg);
    const isMinTarget =
      key.mode === 'major' ? [2, 4, 9].includes(deg) : [5].includes(deg);
    const target = chord(targetRoot, isMinTarget ? 'min' : 'maj');
    add(chord(targetRoot + 7, opts.sevenths ? '7' : 'maj'), 'colorful', 'secondaryDominant', romanNumeral(target, key));
  }

  // 5. Emprunts au mode parallèle — colorés.
  if (key.mode === 'major') {
    add(chord(key.tonic + 5, 'min'), 'colorful', 'borrowed'); // iv
    add(chord(key.tonic + 8, 'maj'), 'colorful', 'borrowed'); // bVI
    add(chord(key.tonic + 10, 'maj'), 'colorful', 'borrowed'); // bVII
    add(chord(key.tonic + 3, 'maj'), 'colorful', 'borrowed'); // bIII
  } else {
    add(chord(key.tonic + 5, 'maj'), 'colorful', 'borrowed'); // IV (dorien / majeur parallèle)
    add(chord(key.tonic, 'maj'), 'colorful', 'borrowed'); // I (tierce picarde)
  }

  // 6. Médiantes chromatiques de l'accord actuel — audacieuses (même qualité, à ±3 ou ±4 demi-tons).
  const q: ChordQuality = isMinorish(current.quality) ? 'min' : 'maj';
  for (const iv of [3, 4, 8, 9]) add(chord(current.root + iv, q), 'bold', 'chromaticMediant');
  // Médiantes doublement chromatiques (qualité opposée, aucune note commune) — audacieuses.
  const opposite: ChordQuality = q === 'maj' ? 'min' : 'maj';
  for (const iv of q === 'maj' ? [3, 8] : [4, 9]) add(chord(current.root + iv, opposite), 'bold', 'chromaticMediant');
  // Sixte napolitaine (bII majeur) — audacieuse, prépare la dominante.
  add(chord(key.tonic + 1, 'maj'), 'bold', 'neapolitan');

  return out;
}
