import { describe, expect, it } from 'vitest';
import guitarTable from '../src/data/chord-shapes.guitar.json';
import mandolinTable from '../src/data/chord-shapes.mandolin.json';
import { assignFingers } from '../src/instruments/fingers';
import { GUITAR, MANDOLIN, type Fingering, type FrettedInstrument } from '../src/instruments/model';
import { pianoInversions, PIANO_HIGH, PIANO_LOW } from '../src/instruments/piano';
import { chordPositions, parseFrets } from '../src/instruments/positions';
import { fretSpan, rootInBass, soundingMidi, validateFingering } from '../src/instruments/validate';
import { ALL_QUALITIES, chord, chordPitchClasses, type Chord } from '../src/theory/chords';
import { mod12 } from '../src/theory/notes';

const allChords: Chord[] = [];
for (let r = 0; r < 12; r++) for (const q of ALL_QUALITIES) allChords.push(chord(r, q));

function expectExactNotes(inst: FrettedInstrument, c: Chord, f: Fingering) {
  const got = new Set(soundingMidi(inst, f.frets).map(mod12));
  const want = new Set(chordPitchClasses(c));
  expect([...got].sort()).toEqual([...want].sort());
}

function expectPlayable(inst: FrettedInstrument, f: Fingering) {
  expect(fretSpan(f.frets)).toBeLessThanOrEqual(4);
  const usedFingers = new Set(f.fingers.filter((x) => x > 0));
  expect(usedFingers.size).toBeLessThanOrEqual(4);
  // Un même doigt n'appuie qu'à une seule case (barré possible).
  for (const fing of usedFingers) {
    const frets = new Set(f.frets.filter((_, i) => f.fingers[i] === fing));
    expect(frets.size).toBe(1);
  }
  // Chaque corde appuyée a un doigt ; les cordes à vide / muettes n'en ont pas.
  f.frets.forEach((fr, i) => {
    if (fr !== null && fr > 0) expect(f.fingers[i]).toBeGreaterThan(0);
    else expect(f.fingers[i]).toBe(0);
  });
  expect(f.frets.filter((x) => x !== null).length).toBeGreaterThanOrEqual(inst.minSounding);
}

describe('tables de référence (validées à la main)', () => {
  for (const [name, inst, table] of [
    ['guitare', GUITAR, guitarTable.shapes],
    ['mandoline', MANDOLIN, mandolinTable.shapes],
  ] as const) {
    it(`${name} : chaque entrée produit exactement les notes de l'accord`, () => {
      for (const e of table) {
        const c = chord(e.root, e.quality as Chord['quality']);
        const res = validateFingering(inst, c, parseFrets(e.frets));
        expect(res.errors, `${e.name} ${e.frets}`).toEqual([]);
      }
    });
  }
});

describe('positions générées — guitare', () => {
  it('12 fondamentales × 7 types : notes EXACTES et jouabilité, pour chaque position', () => {
    for (const c of allChords) {
      const pos = chordPositions(GUITAR, c);
      expect(pos.length, JSON.stringify(c)).toBeGreaterThanOrEqual(2);
      for (const f of pos) {
        expectExactNotes(GUITAR, c, f);
        expectPlayable(GUITAR, f);
      }
    }
  });
  it('majeurs et mineurs : au moins 3 positions, dont une fondamentale à la basse', () => {
    for (const c of allChords.filter((x) => x.quality === 'maj' || x.quality === 'min')) {
      const pos = chordPositions(GUITAR, c);
      expect(pos.length).toBeGreaterThanOrEqual(3);
      expect(pos.some((f) => rootInBass(GUITAR, c, f.frets))).toBe(true);
    }
  });
  it('barré forme E et forme A présents pour les majeurs', () => {
    for (let r = 0; r < 12; r++) {
      const labels = chordPositions(GUITAR, chord(r)).map((f) => f.label);
      expect(labels).toContain('eShape');
      expect(labels).toContain('aShape');
    }
  });
  it('positions triées du bas vers le haut du manche', () => {
    const pos = chordPositions(GUITAR, chord(7));
    const low = pos.map((f) => Math.min(...f.frets.map((x) => (x === null || x === 0 ? 99 : x)), 99));
    const lowNorm = low.map((x) => (x === 99 ? 0 : x));
    expect([...lowNorm].sort((a, b) => a - b)).toEqual(lowNorm);
  });
  it('Fa barré : doigts 1 3 3 2 1 1 → barré + 3 doigts', () => {
    const fa = assignFingers(parseFrets('133211'))!;
    expect(fa.barre).toEqual({ fret: 1, fromString: 0, toString: 5 });
    expect(fa.fingers).toEqual([1, 3, 4, 2, 1, 1]);
  });
  it('Do ouvert : doigts classiques 3 2 0 1 0', () => {
    expect(assignFingers(parseFrets('x32010'))!.fingers).toEqual([0, 3, 2, 0, 1, 0]);
  });
  it('rejette un doigté à 5 doigts sans barré possible', () => {
    expect(assignFingers(parseFrets('123401'))).toBeNull();
  });
  it('détecte une note en trop ou manquante', () => {
    expect(validateFingering(GUITAR, chord(0), parseFrets('x32210')).ok).toBe(false); // A en trop
    expect(validateFingering(GUITAR, chord(0), parseFrets('x3x01x')).errors.length).toBeGreaterThan(0);
  });
});

describe('positions générées — mandoline', () => {
  it('12 fondamentales × 7 types : au moins 2 positions, notes exactes et jouables', () => {
    for (const c of allChords) {
      const pos = chordPositions(MANDOLIN, c);
      expect(pos.length, JSON.stringify(c)).toBeGreaterThanOrEqual(2);
      for (const f of pos) {
        expect(f.frets.length).toBe(4);
        expectExactNotes(MANDOLIN, c, f);
        expectPlayable(MANDOLIN, f);
      }
    }
  });
});

describe('piano', () => {
  it('renversements : bonnes notes, bonne basse, dans les 2 octaves', () => {
    for (const c of allChords) {
      const invs = pianoInversions(c);
      const pcs = chordPitchClasses(c);
      expect(invs.length).toBe(pcs.length);
      invs.forEach((v, i) => {
        expect(new Set(v.midi.map(mod12))).toEqual(new Set(pcs));
        expect(v.midi.length).toBe(pcs.length);
        const bass = Math.min(...v.midi);
        expect(mod12(bass)).toBe(pcs[i]);
        expect(bass).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(Math.max(...v.midi)).toBeLessThanOrEqual(PIANO_HIGH);
      });
    }
  });
});
