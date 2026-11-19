import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../src/audio/ring-buffer';
import { ChordDetector } from '../src/detection/detector';
import { GUITAR } from '../src/instruments/model';
import { chordPositions } from '../src/instruments/positions';
import { soundingMidi } from '../src/instruments/validate';
import { chord, chordId, type Chord } from '../src/theory/chords';
import { midiToFreq } from '../src/theory/notes';

const SR = 48000;

describe('tampon circulaire', () => {
  it('lit exactement les échantillons demandés, par numéro de frame', () => {
    const rb = new RingBuffer(1024);
    const chunk = new Float32Array(128);
    for (let b = 0; b < 20; b++) {
      for (let i = 0; i < 128; i++) chunk[i] = b * 128 + i;
      rb.write(chunk, 1000 + b * 128);
    }
    expect(rb.lastFrame).toBe(1000 + 20 * 128 - 1);
    const r = rb.read(10, 1000 + 2000)!;
    expect([...r]).toEqual(Array.from({ length: 10 }, (_, i) => 1991 + i));
    expect(rb.read(2000, rb.lastFrame)).toBeNull(); // plus grand que la capacité
    expect(rb.read(10, rb.lastFrame + 5)).toBeNull(); // futur
  });
  it('comble un trou (bloc perdu) par du silence sans décaler l’horodatage', () => {
    const rb = new RingBuffer(1024);
    rb.write(new Float32Array(128).fill(1), 0);
    rb.write(new Float32Array(128).fill(2), 256);
    expect(rb.read(1, 200)![0]).toBe(0);
    expect(rb.read(1, 300)![0]).toBe(2);
  });
});

describe('détecteur temps réel (flux simulé)', () => {
  function stream(seq: { c: Chord; dur: number }[]) {
    const total = Math.round(seq.reduce((s, x) => s + x.dur, 0) * SR);
    const out = new Float32Array(total);
    let off = 0;
    for (const { c, dur } of seq) {
      const midis = soundingMidi(GUITAR, chordPositions(GUITAR, c)[0]!.frets);
      const n = Math.round(dur * SR);
      for (const m of midis) {
        const f = midiToFreq(m);
        for (let h = 1; h <= 5; h++)
          for (let i = 0; i < n; i++) out[off + i]! += (0.06 / h) * Math.exp((-1.2 * i) / SR) * Math.sin((2 * Math.PI * f * h * i) / SR + h);
      }
      off += n;
    }
    return out;
  }
  it('C → G → Am : chaque accord affiché en moins d’une seconde, sans « clignotement »', () => {
    const seq = [{ c: chord(0), dur: 1.5 }, { c: chord(7), dur: 1.5 }, { c: chord(9, 'min'), dur: 1.5 }];
    const x = stream(seq);
    const rb = new RingBuffer(1 << 15);
    const det = new ChordDetector(SR);
    const shown: { t: number; id: string | null }[] = [];
    for (let i = 0; i < x.length; i += 128) {
      rb.write(x.subarray(i, i + 128), i);
      if (i % 2048 === 0) {
        const t = (i / SR) * 1000;
        const r = det.step(rb, t);
        const id = r.state.current ? chordId(r.state.current) : null;
        if (shown.length === 0 || shown[shown.length - 1]!.id !== id) shown.push({ t, id });
      }
    }
    const ids = shown.map((s) => s.id).filter((x) => x !== null);
    expect(ids).toEqual(['0:maj', '7:maj', '9:min']);
    const at = (id: string) => shown.find((s) => s.id === id)!.t;
    expect(at('0:maj')).toBeLessThan(1000);
    expect(at('7:maj') - 1500).toBeLessThan(1000);
    expect(at('9:min') - 3000).toBeLessThan(1000);
  });
});

describe('reconnaissance adaptative (bruit de fond)', () => {
  it('le plancher descend vite et remonte lentement', async () => {
    const { NoiseFloor } = await import('../src/detection/noise-floor');
    const nf = new NoiseFloor();
    nf.update(0.2, 0); // première trame forte : ce n'est pas du bruit
    expect(nf.value).toBeLessThan(0.001);
    for (let t = 0; t <= 10; t += 0.05) nf.update(0.01, t); // bruit constant pendant 10 s
    expect(nf.value).toBeCloseTo(0.01, 4);
    nf.update(0.002, 10.05); // la pièce redevient calme : descente immédiate
    expect(nf.value).toBeCloseTo(0.002);
    for (let t = 10.1; t <= 11.1; t += 0.05) nf.update(0.2, t); // note forte 1 s : +50 % au plus
    expect(nf.value).toBeLessThan(0.0031);
    expect(nf.gate(0.0001)).toBeCloseTo(nf.value * 2.5);
    expect(nf.gate(0.05)).toBe(0.05); // jamais sous le réglage manuel
  });
  it('pièce bruyante : le seuil s’adapte, le bruit seul ne produit pas d’accord, l’accord passe', () => {
    const rb = new RingBuffer(1 << 15);
    const det = new ChordDetector(SR);
    det.manualGate = 0.001;
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    // 10 s de bruit de fond (RMS ≈ 0,012)
    const noise = new Float32Array(10 * SR);
    for (let i = 0; i < noise.length; i++) noise[i] = 0.02 * rnd();
    let frame = 0;
    let shown: string | null = null;
    for (let i = 0; i < noise.length; i += 2048) {
      rb.write(noise.subarray(i, i + 2048), frame + i);
      const r = det.step(rb, ((frame + i) / SR) * 1000);
      if (r.state.current) shown = chordId(r.state.current);
    }
    expect(shown).toBeNull();
    expect(det.noise.value).toBeGreaterThan(0.008);
    frame += noise.length;
    // Puis un accord de Ré par-dessus le même bruit
    const midis = soundingMidi(GUITAR, chordPositions(GUITAR, chord(2))[0]!.frets);
    const x = new Float32Array(1.5 * SR);
    for (let i = 0; i < x.length; i++) {
      let v = 0.02 * rnd();
      for (const m of midis) for (let h = 1; h <= 4; h++) v += (0.05 / h) * Math.sin((2 * Math.PI * midiToFreq(m) * h * i) / SR);
      x[i] = v;
    }
    for (let i = 0; i < x.length; i += 2048) {
      rb.write(x.subarray(i, i + 2048), frame + i);
      const r = det.step(rb, ((frame + i) / SR) * 1000);
      if (r.state.current) shown = chordId(r.state.current);
    }
    expect(shown).toBe('2:maj');
  });
});
