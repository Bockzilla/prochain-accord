import { describe, expect, it } from 'vitest';
import { yinPitch } from '../src/detection/pitch';
import { NoteTracker } from '../src/detection/note-tracker';
import { noteLevel, pentatonicPositions, positionRange, positionsOfMidi, scaleOnNeck, STANDARD_TUNING } from '../src/theory/fretboard';
import { chord, chordPitchClasses } from '../src/theory/chords';
import { midiToFreq, mod12 } from '../src/theory/notes';

const SR = 48000;
function tone(freq: number, amp = 0.1, n = 4096) {
  const x = new Float32Array(n);
  [0.7, 1, 0.5, 0.3].forEach((a, k) => {
    for (let i = 0; i < n; i++) x[i]! += amp * a * Math.sin((2 * Math.PI * freq * (k + 1) * i) / SR + k);
  });
  return x;
}

describe('positions d’une hauteur sur le manche', () => {
  it('La3 (MIDI 57) existe à 4 endroits entre les cases 0 et 17', () => {
    expect(positionsOfMidi(57)).toEqual([
      { string: 0, fret: 17 },
      { string: 1, fret: 12 },
      { string: 2, fret: 7 },
      { string: 3, fret: 2 },
    ]);
  });
  it('chaque position renvoie exactement la hauteur demandée, pour toute note jouable', () => {
    for (let m = 40; m <= 81; m++) {
      const ps = positionsOfMidi(m);
      expect(ps.length).toBeGreaterThanOrEqual(1);
      for (const p of ps) expect(STANDARD_TUNING[p.string]! + p.fret).toBe(m);
    }
    expect(positionsOfMidi(39)).toEqual([]); // sous la corde de Mi grave
  });
});

describe('suivi de la note jouée (improvisation)', () => {
  it('annonce la note après 2 mesures concordantes, avec l’écart en cents', () => {
    const tr = new NoteTracker();
    expect(tr.update(yinPitch(tone(midiToFreq(57)), SR), 0)).toBeNull();
    const n = tr.update(yinPitch(tone(midiToFreq(57) * 2 ** (8 / 1200)), SR), 40)!;
    expect(n.midi).toBe(57);
    expect(Math.abs(n.cents - 8)).toBeLessThanOrEqual(2);
  });
  it('change de note quand on en joue une autre ; s’efface au silence', () => {
    const tr = new NoteTracker();
    for (let t = 0; t < 120; t += 40) tr.update(yinPitch(tone(midiToFreq(60)), SR), t);
    let n = null;
    for (let t = 120; t < 240; t += 40) n = tr.update(yinPitch(tone(midiToFreq(62)), SR), t);
    expect(n!.midi).toBe(62);
    tr.update(yinPitch(new Float32Array(4096), SR), 260);
    expect(tr.update(yinPitch(new Float32Array(4096), SR), 520)).toBeNull();
  });
  it('un accord ne produit pas de « note jouée »', () => {
    const tr = new NoteTracker();
    const x = tone(110);
    const y = tone(138.59);
    const z = tone(164.81);
    for (let i = 0; i < x.length; i++) x[i]! += y[i]! + z[i]!;
    for (let t = 0; t < 400; t += 40) expect(tr.update(yinPitch(x, SR), t)).toBeNull();
  });
});

describe('hiérarchie d’affichage du manche', () => {
  const scale = { tonic: 9, type: 'minorPentatonic' as const };
  const box = pentatonicPositions(scale)[0]!;
  const boxSet = new Set(box.map((n) => `${n.string}:${n.fret}`));
  const range = positionRange(box);
  const F = new Set(chordPitchClasses(chord(5))); // Fa : F A C
  it('note jouée > note de l’accord > position > voisines (±2 cases) > contexte', () => {
    const notes = scaleOnNeck(scale, STANDARD_TUNING, 17);
    const lv = (s: number, f: number, played: number | null = null) => {
      const n = notes.find((x) => x.string === s && x.fret === f)!;
      return noteLevel(n, { playedMidi: played, chordPcs: F, box: boxSet, boxRange: range });
    };
    expect(lv(1, 7, 52)).toBe('played'); // Mi2 de la corde de La, joué
    expect(lv(0, 5)).toBe('chordTone'); // La : note de Fa majeur
    expect(lv(1, 7)).toBe('position'); // Mi : dans la boîte, pas dans l'accord
    expect(lv(3, 9)).toBe('neighbor'); // Mi sur la corde de Sol, case 9 : position voisine (cases 3 à 10)
    expect(lv(4, 1)).toBe('chordTone'); // Do : note de l'accord, même hors position
    expect(lv(2, 14)).toBe('context'); // Mi sur la corde de Ré, case 14 : loin de la position
  });
  it('quand l’accord passe d’Am à F, les notes cibles changent aussitôt', () => {
    const Am = new Set(chordPitchClasses(chord(9, 'min')));
    const notes = scaleOnNeck(scale, STANDARD_TUNING, 17);
    const targets = (pcs: Set<number>) =>
      notes.filter((n) => noteLevel(n, { playedMidi: null, chordPcs: pcs, box: boxSet, boxRange: range }) === 'chordTone').map((n) => mod12(n.pc));
    expect(new Set(targets(Am))).toEqual(new Set([9, 0, 4]));
    expect(new Set(targets(F))).toEqual(new Set([9, 0])); // Fa n'est pas dans la penta de La : seuls La et Do
  });
});
