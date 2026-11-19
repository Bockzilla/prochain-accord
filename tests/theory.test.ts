import { describe, expect, it } from 'vitest';
import {
  camelotLabel,
  camelotNeighbours,
  chord,
  chordPitchClasses,
  estimateKey,
  freqToMidi,
  fromCamelot,
  keySpelling,
  midiToFreq,
  relativeKey,
  romanNumeral,
  spell,
  spelledToPc,
  toCamelot,
  type Chord,
  type Key,
} from '../src/theory';

const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11;

describe('notes', () => {
  it('A4 = 440 Hz et aller-retour MIDI ↔ fréquence', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
    expect(freqToMidi(82.4069)).toBeCloseTo(40, 3);
    expect(midiToFreq(69, 432)).toBeCloseTo(432);
  });
  it('orthographe dièse / bémol cohérente', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(spelledToPc(spell(pc, 'sharp'))).toBe(pc);
      expect(spelledToPc(spell(pc, 'flat'))).toBe(pc);
    }
    expect(spell(10, 'flat')).toEqual({ letter: 6, accidental: -1 });
  });
  it('tonalités à bémols', () => {
    expect(keySpelling({ tonic: F, mode: 'major' })).toBe('flat');
    expect(keySpelling({ tonic: D, mode: 'minor' })).toBe('flat');
    expect(keySpelling({ tonic: G, mode: 'major' })).toBe('sharp');
    expect(keySpelling({ tonic: E, mode: 'minor' })).toBe('sharp');
  });
});

describe('accords', () => {
  it('notes des accords', () => {
    expect(chordPitchClasses(chord(C))).toEqual([0, 4, 7]);
    expect(chordPitchClasses(chord(A, 'min'))).toEqual([9, 0, 4]);
    expect(chordPitchClasses(chord(G, '7'))).toEqual([7, 11, 2, 5]);
    expect(chordPitchClasses(chord(D, 'sus4'))).toEqual([2, 7, 9]);
  });
});

describe('estimation de tonalité (Krumhansl-Kessler)', () => {
  const k = (h: Chord[]) => estimateKey(h.map((c) => ({ chord: c })))!.key;
  it('I–IV–V–I en Do', () => {
    expect(k([chord(C), chord(F), chord(G), chord(C)])).toEqual({ tonic: C, mode: 'major' });
  });
  it('I–V–vi–IV en Sol', () => {
    expect(k([chord(G), chord(D), chord(E, 'min'), chord(C)])).toEqual({ tonic: G, mode: 'major' });
  });
  it('i–iv–V–i en La mineur', () => {
    expect(k([chord(A, 'min'), chord(D, 'min'), chord(E), chord(A, 'min')])).toEqual({ tonic: A, mode: 'minor' });
  });
  it('I–vi–IV–V en Ré', () => {
    expect(k([chord(D), chord(B, 'min'), chord(G), chord(A)])).toEqual({ tonic: D, mode: 'major' });
  });
  it('historique vide → null', () => {
    expect(estimateKey([])).toBeNull();
  });
  it('relatif', () => {
    expect(relativeKey({ tonic: C, mode: 'major' })).toEqual({ tonic: A, mode: 'minor' });
    expect(relativeKey({ tonic: E, mode: 'minor' })).toEqual({ tonic: G, mode: 'major' });
  });
});

describe('chiffres romains', () => {
  const Cmaj: Key = { tonic: C, mode: 'major' };
  const Amin: Key = { tonic: A, mode: 'minor' };
  it('diatoniques en majeur', () => {
    expect(romanNumeral(chord(C), Cmaj)).toBe('I');
    expect(romanNumeral(chord(D, 'min'), Cmaj)).toBe('ii');
    expect(romanNumeral(chord(G, '7'), Cmaj)).toBe('V7');
    expect(romanNumeral(chord(A, 'min'), Cmaj)).toBe('vi');
    expect(romanNumeral(chord(10), Cmaj)).toBe('bVII');
    expect(romanNumeral(chord(F, 'min'), Cmaj)).toBe('iv');
  });
  it('en mineur', () => {
    expect(romanNumeral(chord(A, 'min'), Amin)).toBe('i');
    expect(romanNumeral(chord(C), Amin)).toBe('III');
    expect(romanNumeral(chord(E), Amin)).toBe('V');
    expect(romanNumeral(chord(G), Amin)).toBe('VII');
  });
});

describe('Camelot (préparation DJ)', () => {
  it('repères connus', () => {
    expect(camelotLabel(toCamelot({ tonic: C, mode: 'major' }))).toBe('8B');
    expect(camelotLabel(toCamelot({ tonic: A, mode: 'minor' }))).toBe('8A');
    expect(camelotLabel(toCamelot({ tonic: G, mode: 'major' }))).toBe('9B');
    expect(camelotLabel(toCamelot({ tonic: B, mode: 'major' }))).toBe('1B');
    expect(camelotLabel(toCamelot({ tonic: F, mode: 'major' }))).toBe('7B');
    expect(camelotLabel(toCamelot({ tonic: E, mode: 'minor' }))).toBe('9A');
  });
  it('aller-retour pour les 24 tonalités', () => {
    for (let t = 0; t < 12; t++)
      for (const mode of ['major', 'minor'] as const)
        expect(fromCamelot(toCamelot({ tonic: t, mode }))).toEqual({ tonic: t, mode });
  });
  it('voisins', () => {
    expect(camelotNeighbours({ number: 12, letter: 'B' }).map(camelotLabel)).toEqual(['11B', '1B', '12A']);
  });
});
