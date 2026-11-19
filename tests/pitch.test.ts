import { describe, expect, it } from 'vitest';
import { yinPitch } from '../src/detection/pitch';
import { centsBetween, GUITAR_STRINGS, targetFor, TunerStabilizer } from '../src/detection/tuner';
import { midiToFreq } from '../src/theory/notes';

const SR = 48000;
const N = 4096;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

/** Note « de guitare » : fondamentale faible, 2e harmonique forte (cas difficile pour l'octave). */
function tone(freq: number, opts: { harm?: number[]; noise?: number; seed?: number; n?: number } = {}): Float32Array {
  const n = opts.n ?? N;
  const r = rng(opts.seed ?? 3);
  const harm = opts.harm ?? [0.6, 1, 0.5, 0.3, 0.2];
  const x = new Float32Array(n);
  harm.forEach((a, k) => {
    const ph = Math.abs(r()) * 6.28;
    for (let i = 0; i < n; i++) x[i]! += 0.1 * a * Math.sin((2 * Math.PI * freq * (k + 1) * i) / SR + ph);
  });
  for (let i = 0; i < n; i++) x[i]! += (opts.noise ?? 0) * r();
  return x;
}

describe('YIN — hauteur', () => {
  it('6 cordes à vide : à moins de 1 cent, sans erreur d’octave', () => {
    for (const m of GUITAR_STRINGS) {
      const p = yinPitch(tone(midiToFreq(m)), SR)!;
      expect(Math.abs(centsBetween(p.freq, m)), `midi ${m}`).toBeLessThan(1);
      expect(p.clarity).toBeGreaterThan(0.9);
    }
  });
  it('notes chromatiques de Mi2 à Mi5, avec bruit : à moins de 3 cents', () => {
    for (let m = 40; m <= 76; m++) {
      const p = yinPitch(tone(midiToFreq(m), { noise: 0.01, seed: m }), SR)!;
      expect(Math.abs(centsBetween(p.freq, m)), `midi ${m}`).toBeLessThan(3);
    }
  });
  it('désaccord de +12 cents mesuré à ±1 cent', () => {
    const f = midiToFreq(45) * 2 ** (12 / 1200);
    expect(centsBetween(yinPitch(tone(f), SR)!.freq, 45)).toBeCloseTo(12, 0);
  });
  it('accord (plusieurs notes) ou bruit : clarté faible', () => {
    const chord = tone(110);
    const c2 = tone(138.59);
    const c3 = tone(164.81);
    for (let i = 0; i < N; i++) chord[i]! += c2[i]! + c3[i]!;
    expect(yinPitch(chord, SR)!.clarity).toBeLessThan(0.85);
    const r = rng(9);
    const noise = new Float32Array(N).map(() => 0.1 * r());
    expect(yinPitch(noise, SR)!.clarity).toBeLessThan(0.5);
  });
});

describe('accordeur', () => {
  it('mode guitare : vise la corde la plus proche', () => {
    expect(targetFor(midiToFreq(44.6), 'guitar')).toEqual({ target: 45, string: 1 });
    expect(targetFor(midiToFreq(62), 'guitar').target).toBe(64); // Ré4 → corde de Mi aigu
    expect(targetFor(midiToFreq(62), 'chromatic')).toEqual({ target: 62, string: null });
  });
  it('A4 configurable : 432 Hz est « juste » avec A4 = 432', () => {
    expect(Math.abs(centsBetween(432, 69, 432))).toBeLessThan(0.001);
    expect(centsBetween(440, 69, 432)).toBeGreaterThan(30);
  });
  it('lecture stable et « juste » après quelques mesures concordantes', () => {
    const st = new TunerStabilizer('guitar');
    let r = null;
    for (let i = 0; i < 5; i++) r = st.update(yinPitch(tone(midiToFreq(50) * 2 ** (2 / 1200), { seed: i }), SR));
    expect(r!.stable).toBe(true);
    expect(r!.inTune).toBe(true);
    expect(r!.string).toBe(2);
  });
  it('rejette les signaux instables : hauteur qui saute → jamais « stable »', () => {
    const st = new TunerStabilizer('chromatic');
    const freqs = [110, 147, 104, 165, 98, 131];
    const rs = freqs.map((f, i) => st.update(yinPitch(tone(f, { seed: i }), SR)));
    expect(rs.some((r) => r?.stable)).toBe(false);
  });
  it('rejette un accord et le silence', () => {
    const st = new TunerStabilizer('guitar');
    const chord = tone(110);
    const c2 = tone(138.59);
    for (let i = 0; i < N; i++) chord[i]! += c2[i]!;
    expect(st.update(yinPitch(chord, SR))).toBeNull();
    expect(st.update(yinPitch(new Float32Array(N), SR))).toBeNull();
  });
});
