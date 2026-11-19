import { describe, expect, it } from 'vitest';
import {
  analyzeProgression,
  chord,
  chordPitchClasses,
  diatonicTriads,
  harmonicFunction,
  intervalName,
  mod12,
  pentatonicPositions,
  positionRange,
  PROGRESSIONS,
  realizeProgression,
  relativeScale,
  SCALE_TYPES,
  scaleNotes,
  scaleOnNeck,
  STANDARD_TUNING,
  suggestScales,
  type Chord,
  type ScaleType,
} from '../src/theory';

const PENTAS: ScaleType[] = ['minorPentatonic', 'majorPentatonic'];

describe('gammes — 12 tonalités', () => {
  it('notes exactes de chaque gamme dans les 12 tonalités (calculées, pas codées)', () => {
    const ref: Record<ScaleType, number[]> = {
      minorPentatonic: [9, 0, 2, 4, 7], // La mineur penta : A C D E G
      majorPentatonic: [0, 2, 4, 7, 9], // Do majeur penta : C D E G A
      blues: [9, 0, 2, 3, 4, 7], // La blues : A C D D# E G
      naturalMinor: [9, 11, 0, 2, 4, 5, 7], // La mineur naturel
      major: [0, 2, 4, 5, 7, 9, 11], // Do majeur
      mixolydian: [0, 2, 4, 5, 7, 9, 10], // Do mixolydien
    };
    const refTonic: Record<ScaleType, number> = { minorPentatonic: 9, majorPentatonic: 0, blues: 9, naturalMinor: 9, major: 0, mixolydian: 0 };
    for (const type of SCALE_TYPES) {
      for (let t = 0; t < 12; t++) {
        const shift = t - refTonic[type];
        const expected = ref[type].map((p) => mod12(p + shift));
        expect(scaleNotes({ tonic: t, type }), `${type} ${t}`).toEqual(expected);
      }
    }
  });
  it('relatives : La mineur ↔ Do majeur, mêmes notes', () => {
    for (let t = 0; t < 12; t++) {
      for (const type of ['minorPentatonic', 'naturalMinor'] as ScaleType[]) {
        const r = relativeScale({ tonic: t, type })!;
        expect(new Set(scaleNotes(r))).toEqual(new Set(scaleNotes({ tonic: t, type })));
      }
    }
  });
  it('noms d’intervalles', () => {
    expect([0, 3, 5, 7, 10].map(intervalName)).toEqual(['1', '♭3', '4', '5', '♭7']);
    expect([2, 4, 6, 9, 11].map(intervalName)).toEqual(['2', '3', '♭5', '6', '7']);
  });
});

describe('manche — notes de la gamme', () => {
  it('cases 0 à 15 : chaque note affichée appartient à la gamme, aucune n’est oubliée', () => {
    for (const type of SCALE_TYPES)
      for (let t = 0; t < 12; t++) {
        const pcs = new Set(scaleNotes({ tonic: t, type }));
        const notes = scaleOnNeck({ tonic: t, type });
        expect(notes.every((n) => pcs.has(n.pc))).toBe(true);
        for (let s = 0; s < 6; s++)
          for (let f = 0; f <= 15; f++) {
            const pc = mod12(STANDARD_TUNING[s]! + f);
            expect(notes.some((n) => n.string === s && n.fret === f), `${type} t${t} s${s} f${f}`).toBe(pcs.has(pc));
          }
        // Fondamentales repérées, intervalle « 1 »
        expect(notes.filter((n) => n.isRoot).every((n) => n.interval === '1' && n.pc === t)).toBe(true);
      }
  });
  it('La mineur penta : les 5 La des cases 5 et 17 sont bien des fondamentales', () => {
    const roots = scaleOnNeck({ tonic: 9, type: 'minorPentatonic' }).filter((n) => n.isRoot).map((n) => `${n.string}:${n.fret}`);
    expect(roots).toEqual(expect.arrayContaining(['0:5', '1:0', '1:12', '2:7', '3:2', '3:14', '4:10', '5:5']));
  });
});

describe('cinq positions pentatoniques', () => {
  it('La mineur : positions classiques (cases de départ 5, 8, 10, 12/0, 15/3)', () => {
    const pos = pentatonicPositions({ tonic: 9, type: 'minorPentatonic' });
    expect(pos.map((b) => b.find((n) => n.string === 0)!.fret)).toEqual([5, 8, 10, 0, 3]);
    // Position 1 note par note (forme « en boîte » bien connue)
    expect(pos[0]!.map((n) => `${n.string}:${n.fret}`)).toEqual(['0:5', '0:8', '1:5', '1:7', '2:5', '2:7', '3:5', '3:7', '4:5', '4:8', '5:5', '5:8']);
  });
  for (const type of PENTAS) {
    it(`${type} — 12 tonalités × 5 positions : 2 notes par corde, gamme montante, jouable`, () => {
      for (let t = 0; t < 12; t++) {
        const pcs = scaleNotes({ tonic: t, type });
        const pos = pentatonicPositions({ tonic: t, type });
        expect(pos.length).toBe(5);
        const starts = new Set<number>();
        pos.forEach((box) => {
          expect(box.length).toBe(12);
          for (let s = 0; s < 6; s++) expect(box.filter((n) => n.string === s).length).toBe(2);
          expect(box.every((n) => pcs.includes(n.pc))).toBe(true);
          // Hauteurs strictement croissantes, notes consécutives de la gamme
          for (let i = 1; i < box.length; i++) {
            expect(box[i]!.midi).toBeGreaterThan(box[i - 1]!.midi);
            const gap = box[i]!.midi - box[i - 1]!.midi;
            expect(gap === 2 || gap === 3).toBe(true);
          }
          const r = positionRange(box);
          expect(r.from).toBeGreaterThanOrEqual(0);
          expect(r.to).toBeLessThanOrEqual(17);
          expect(r.to - r.from).toBeLessThanOrEqual(4); // une main, une position
          expect(box.some((n) => n.isRoot)).toBe(true);
          starts.add(box[0]!.pc);
        });
        expect(starts.size).toBe(5); // chaque position démarre sur une note différente
      }
    });
  }
  it('transposition : la position p de Si♭ = celle de La décalée d’une case', () => {
    const a = pentatonicPositions({ tonic: 9, type: 'minorPentatonic' });
    const bb = pentatonicPositions({ tonic: 10, type: 'minorPentatonic' });
    a.forEach((box, p) => {
      const shifted = box.map((n) => mod12(n.fret + 1));
      expect(bb[p]!.map((n) => mod12(n.fret))).toEqual(shifted);
    });
  });
  it('majeure = relative mineure : les 5 boîtes de Do majeur sont celles de La mineur', () => {
    const c = pentatonicPositions({ tonic: 0, type: 'majorPentatonic' }).map((b) => b.map((n) => `${n.string}:${n.fret}`).join());
    const am = pentatonicPositions({ tonic: 9, type: 'minorPentatonic' }).map((b) => b.map((n) => `${n.string}:${n.fret}`).join());
    expect(new Set(c)).toEqual(new Set(am));
  });
  it('blues : la ♭5 est ajoutée dans les boîtes', () => {
    const pos = pentatonicPositions({ tonic: 9, type: 'blues' });
    for (const box of pos) expect(box.some((n) => n.interval === '♭5')).toBe(true);
  });
});

describe('assistant d’harmonie', () => {
  it('accords diatoniques et fonctions — Do majeur', () => {
    const d = diatonicTriads({ tonic: 0, mode: 'major' });
    expect(d.map((x) => x.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(d.map((x) => x.fn)).toEqual(['tonic', 'subdominant', 'tonic', 'subdominant', 'dominant', 'tonic', 'dominant']);
  });
  it('accords diatoniques — La mineur', () => {
    expect(diatonicTriads({ tonic: 9, mode: 'minor' }).map((x) => x.roman)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  });
  it('les 7 accords diatoniques n’utilisent que les notes de la gamme (12 tonalités, 2 modes)', () => {
    for (let t = 0; t < 12; t++)
      for (const mode of ['major', 'minor'] as const) {
        const scale = new Set(scaleNotes({ tonic: t, type: mode === 'major' ? 'major' : 'naturalMinor' }));
        for (const d of diatonicTriads({ tonic: t, mode })) for (const p of chordPitchClasses(d.chord)) expect(scale.has(p)).toBe(true);
      }
  });
  it('V majeur en mineur = dominante ; accord hors tonalité = « outside »', () => {
    expect(harmonicFunction(chord(4), { tonic: 9, mode: 'minor' })).toBe('dominant');
    expect(harmonicFunction(chord(1), { tonic: 0, mode: 'major' })).toBe('outside');
  });
  it('Am – F – C – G : ambiguïté Do majeur / La mineur signalée, pas de fausse certitude', () => {
    const a = analyzeProgression([chord(9, 'min'), chord(5), chord(0), chord(7)])!;
    expect(a.relativeAmbiguity).toBe(true);
    expect(a.certainty).toBe('low');
    const keys = a.candidates.slice(0, 2).map((c) => `${c.key.tonic}${c.key.mode}`);
    expect(keys).toEqual(expect.arrayContaining(['0major', '9minor']));
    // La gamme proposée en premier marche pour les deux lectures (mêmes notes).
    const first = new Set(scaleNotes(a.scales[0]!.scale));
    expect(first).toEqual(new Set([0, 2, 4, 7, 9]));
  });
  it('Am – Dm – E – Am : la sensible (Sol♯) tranche pour La mineur', () => {
    const a = analyzeProgression([chord(9, 'min'), chord(2, 'min'), chord(4), chord(9, 'min')])!;
    expect(a.best).toEqual({ tonic: 9, mode: 'minor' });
    expect(a.relativeAmbiguity).toBe(false);
    expect(a.chords.map((c) => c.fn)).toEqual(['tonic', 'subdominant', 'dominant', 'tonic']);
  });
  it('C – F – G – C : Do majeur, certitude haute', () => {
    const a = analyzeProgression([chord(0), chord(5), chord(7), chord(0)])!;
    expect(a.best).toEqual({ tonic: 0, mode: 'major' });
    expect(a.certainty).toBe('high');
  });
  it('un ou deux accords : jamais « certitude haute »', () => {
    expect(analyzeProgression([chord(0)])!.certainty).not.toBe('high');
    expect(analyzeProgression([chord(0), chord(7)])!.certainty).not.toBe('high');
  });
});

describe('progressions par style et cohérence accords ↔ gammes', () => {
  it('chaque progression, dans les 12 tonalités : la gamme complète proposée contient les notes des accords diatoniques', () => {
    for (const p of PROGRESSIONS.filter((x) => x.style !== 'blues'))
      for (let t = 0; t < 12; t++) {
        const { key, chords } = realizeProgression(p, t);
        const full = suggestScales(chords, key, p.style).find((s) => s.reason === 'fullScale');
        expect(full, p.id).toBeDefined();
        const pcs = new Set(scaleNotes(full!.scale));
        // En mineur, le V majeur ajoute la sensible (hors gamme naturelle) : on l'écarte de la vérification.
        const checked = chords.filter((c) => p.mode === 'major' || !(c.root === mod12(t + 7) && c.quality !== 'min'));
        for (const c of checked) for (const x of chordPitchClasses(c)) expect(pcs.has(x), `${p.id} ${t}`).toBe(true);
      }
  });
  it('la pentatonique « sûre » est contenue dans la gamme complète', () => {
    for (let t = 0; t < 12; t++)
      for (const mode of ['major', 'minor'] as const) {
        const sug = suggestScales([chord(t, mode === 'major' ? 'maj' : 'min')], { tonic: t, mode });
        const penta = sug.find((s) => s.reason === 'pentatonicSafe')!;
        const full = sug.find((s) => s.reason === 'fullScale')!;
        for (const p of scaleNotes(penta.scale)) expect(scaleNotes(full.scale)).toContain(p);
      }
  });
  it('I – ♭VII – IV (rock) : le mixolydien est proposé, pas le majeur', () => {
    const p = PROGRESSIONS.find((x) => x.id === 'rockI_bVII_IV')!;
    const { key, chords } = realizeProgression(p, 0);
    const full = suggestScales(chords, key, 'rock').find((s) => s.reason === 'fullScale')!;
    expect(full.scale).toEqual({ tonic: 0, type: 'mixolydian' });
    expect(full.coverage).toBe(1);
  });
  it('blues : la pentatonique mineure de la tonique est proposée en premier', () => {
    const b = PROGRESSIONS.find((p) => p.id === 'blues12')!;
    for (let t = 0; t < 12; t++) {
      const { key, chords } = realizeProgression(b, t);
      expect(suggestScales(chords, key, 'blues')[0]!.scale).toEqual({ tonic: t, type: 'minorPentatonic' });
    }
  });
  it('les progressions se transposent sans changer leurs chiffres romains', () => {
    const roman = (cs: Chord[], t: number, mode: 'major' | 'minor') => analyzeProgression(cs) && cs.map((c) => mod12(c.root - t) + c.quality).join(' ') + mode;
    for (const p of PROGRESSIONS) {
      const ref = realizeProgression(p, 0);
      for (let t = 1; t < 12; t++) {
        const r = realizeProgression(p, t);
        expect(roman(r.chords, t, r.key.mode)).toBe(roman(ref.chords, 0, ref.key.mode));
      }
    }
  });
});
