import { describe, expect, it } from 'vitest';
import { buildCandidates, diatonicChords } from '../src/suggestions/graph';
import { suggestNext } from '../src/suggestions/rank';
import { chord, chordId, sameChord } from '../src/theory/chords';

const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9;
const opts = { count: 6, sevenths: false };

describe('graphe des accords', () => {
  it('diatoniques de Do majeur : C Dm Em F G Am', () => {
    expect(diatonicChords({ tonic: C, mode: 'major' }).map((d) => chordId(d.chord))).toEqual(
      ['0:maj', '2:min', '4:min', '5:maj', '7:maj', '9:min'],
    );
  });
  it('couvre relatif, dominantes secondaires, emprunts et médiantes', () => {
    const cands = buildCandidates(chord(C), { tonic: C, mode: 'major' }, { sevenths: true });
    const has = (r: number, q: string, reason: string) =>
      cands.some((c) => c.chord.root === r && c.chord.quality === q && c.reason === reason);
    expect(has(A, 'min', 'relativeMinor')).toBe(true);
    expect(has(D, '7', 'secondaryDominant')).toBe(true); // V7/V
    expect(has(E, '7', 'secondaryDominant')).toBe(true); // V7/vi
    expect(has(F, 'min', 'borrowed')).toBe(true); // iv
    expect(has(8, 'maj', 'borrowed')).toBe(true); // bVI
    expect(has(10, 'maj', 'borrowed')).toBe(true); // bVII
    expect(has(E, 'maj', 'chromaticMediant')).toBe(true);
    expect(has(8, 'maj', 'chromaticMediant')).toBe(true);
  });
  it('V7/V porte la cible en chiffre romain', () => {
    const c = buildCandidates(chord(C), { tonic: C, mode: 'major' }, { sevenths: true })
      .find((x) => x.chord.root === D && x.reason === 'secondaryDominant')!;
    expect(c.roman).toBe('II7');
    expect(c.reasonTarget).toBe('V');
  });
});

describe('classement des suggestions', () => {
  it('ordre sûr → coloré → audacieux, sans l’accord actuel, sans doublon', () => {
    const r = suggestNext([chord(C), chord(F), chord(G)], opts)!;
    expect(r.suggestions.length).toBe(6);
    const order = r.suggestions.map((s) => ['safe', 'colorful', 'bold'].indexOf(s.category));
    expect([...order].sort()).toEqual(order);
    expect(r.suggestions.some((s) => sameChord(s.chord, chord(G)))).toBe(false);
    const ids = r.suggestions.map((s) => chordId(s.chord));
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.suggestions.some((s) => s.category === 'bold')).toBe(true);
  });
  it('après V en Do, la tonique est la 1re suggestion', () => {
    const r = suggestNext([chord(C), chord(F), chord(G)], opts)!;
    expect(r.key).toEqual({ tonic: C, mode: 'major' });
    expect(chordId(r.suggestions[0]!.chord)).toBe('0:maj');
  });
  it('se met à jour avec la tonalité estimée', () => {
    const inG = suggestNext([chord(G), chord(C), chord(D)], opts)!;
    expect(inG.key).toEqual({ tonic: G, mode: 'major' });
    expect(chordId(inG.suggestions[0]!.chord)).toBe('7:maj');
    const inAm = suggestNext([chord(A, 'min'), chord(D, 'min'), chord(E)], opts)!;
    expect(inAm.key).toEqual({ tonic: A, mode: 'minor' });
    expect(chordId(inAm.suggestions[0]!.chord)).toBe('9:min');
  });
  it('dominante secondaire jouée → résolution proposée', () => {
    // En Do : C, A (V/ii) → Dm doit être proposé.
    const r = suggestNext([chord(C), chord(F), chord(G), chord(C), chord(A)], { ...opts, key: { tonic: C, mode: 'major' } })!;
    const dm = r.suggestions.find((s) => chordId(s.chord) === '2:min');
    expect(dm).toBeDefined();
  });
  it('un seul accord → tonalité supposée sur cet accord', () => {
    const r = suggestNext([chord(E, 'min')], opts)!;
    expect(r.key).toEqual({ tonic: E, mode: 'minor' });
  });
  it('historique vide → null', () => {
    expect(suggestNext([], opts)).toBeNull();
  });
});
