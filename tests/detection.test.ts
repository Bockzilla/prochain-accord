import { describe, expect, it } from 'vitest';
import { analyzeFrame, DEFAULT_ANALYZE } from '../src/detection/analyze';
import { computeChroma } from '../src/detection/chroma';
import { ClickGate } from '../src/detection/click-gate';
import { fft, magnitudeSpectrum } from '../src/detection/fft';
import { ChordStabilizer } from '../src/detection/stabilizer';
import { GUITAR } from '../src/instruments/model';
import { chordPositions } from '../src/instruments/positions';
import { soundingMidi } from '../src/instruments/validate';
import { ALL_QUALITIES, chord, chordId, chordPitchClasses, type Chord } from '../src/theory/chords';
import { midiToFreq } from '../src/theory/notes';

const SR = 48000;
const N = 8192;

/** Générateur pseudo-aléatoire reproductible. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Accord « de guitare » : fondamentales + harmoniques décroissantes + bruit blanc. */
function synthChord(midis: number[], opts: { noise?: number; seed?: number; a4?: number; offset?: number } = {}): Float32Array {
  const r = rng(opts.seed ?? 7);
  const out = new Float32Array(N);
  const harm = [1, 0.55, 0.4, 0.25, 0.18, 0.1, 0.07];
  for (const m of midis) {
    const f0 = midiToFreq(m, opts.a4 ?? 440);
    const amp = 0.08 * (0.8 + 0.4 * r());
    harm.forEach((h, k) => {
      const f = f0 * (k + 1) * (1 + 0.0004 * (k + 1) ** 2); // légère inharmonicité des cordes
      if (f > SR / 2.2) return;
      const ph = r() * 2 * Math.PI;
      for (let i = 0; i < N; i++) {
        const t = (i + (opts.offset ?? 0)) / SR;
        out[i]! += amp * h * Math.exp(-1.5 * t) * Math.sin(2 * Math.PI * f * t + ph);
      }
    });
  }
  const noise = opts.noise ?? 0;
  for (let i = 0; i < N; i++) out[i]! += noise * (r() * 2 - 1);
  return out;
}

const voicing = (c: Chord, pos = 0) => soundingMidi(GUITAR, chordPositions(GUITAR, c)[pos]!.frets);
const triads: Chord[] = [];
for (let r = 0; r < 12; r++) triads.push(chord(r, 'maj'), chord(r, 'min'));

describe('FFT', () => {
  it('sinus pur : pic au bon bin', () => {
    const x = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) x[i] = Math.sin((2 * Math.PI * 64 * i) / 1024);
    const mag = magnitudeSpectrum(x);
    let best = 0;
    for (let k = 1; k < mag.length; k++) if (mag[k]! > mag[best]!) best = k;
    expect(best).toBe(64);
  });
  it('impulsion → spectre plat', () => {
    const re = new Float64Array(16);
    const im = new Float64Array(16);
    re[0] = 1;
    fft(re, im);
    for (let k = 0; k < 16; k++) expect(Math.hypot(re[k]!, im[k]!)).toBeCloseTo(1);
  });
});

describe('chromagramme', () => {
  it('La 440 Hz seul → classe La dominante', () => {
    const c = computeChroma(magnitudeSpectrum(synthChord([69])), SR);
    expect([...c].indexOf(1)).toBe(9);
  });
  it('les harmoniques d’un Do grave ne créent pas de Sol/Mi dominants', () => {
    const c = computeChroma(magnitudeSpectrum(synthChord([48])), SR);
    expect(c[0]).toBe(1);
    expect(c[7]!).toBeLessThan(0.6);
    expect(c[4]!).toBeLessThan(0.6);
  });
});

describe('détection d’accords — signaux synthétiques', () => {
  it('24 accords majeurs et mineurs (doigté guitare réel), pièce calme', () => {
    for (const c of triads) {
      const a = analyzeFrame(synthChord(voicing(c)), SR);
      expect(chordId(a.matches[0]!.chord), JSON.stringify(c)).toBe(chordId(c));
      expect(a.confidence).toBeGreaterThan(0.45);
    }
  });
  it('24 accords, deuxième position (barré), pièce bruyante (bruit fort)', () => {
    let ok = 0;
    for (const c of triads) {
      const a = analyzeFrame(synthChord(voicing(c, 1), { noise: 0.06, seed: c.root * 3 + 1 }), SR);
      if (chordId(a.matches[0]!.chord) === chordId(c)) ok++;
    }
    expect(ok).toBe(24);
  });
  it('accords étendus activés : 7, maj7, m7, sus2, sus4 reconnus', () => {
    const misses: string[] = [];
    for (let r = 0; r < 12; r++)
      for (const q of ['7', 'maj7', 'm7', 'sus2', 'sus4'] as const) {
        const c = chord(r, q);
        const a = analyzeFrame(synthChord(voicing(c)), SR, { ...DEFAULT_ANALYZE, qualities: ALL_QUALITIES });
        if (chordId(a.matches[0]!.chord) !== chordId(c)) misses.push(`${chordId(c)}→${chordId(a.matches[0]!.chord)}`);
      }
    expect(misses).toEqual([]);
  });
  it('les triades restent reconnues quand les types étendus sont activés', () => {
    for (const c of triads) {
      const a = analyzeFrame(synthChord(voicing(c)), SR, { ...DEFAULT_ANALYZE, qualities: ALL_QUALITIES });
      expect(chordId(a.matches[0]!.chord), JSON.stringify(c)).toBe(chordId(c));
    }
  });
  it('réglage A4 : guitare accordée à 432 Hz détectée avec A4 = 432', () => {
    for (const c of triads.slice(0, 8)) {
      const a = analyzeFrame(synthChord(voicing(c), { a4: 432 }), SR, { ...DEFAULT_ANALYZE, chroma: { ...DEFAULT_ANALYZE.chroma, a4: 432 } });
      expect(chordId(a.matches[0]!.chord)).toBe(chordId(c));
    }
  });
  it('silence / bruit faible → gate fermé, aucun accord', () => {
    const x = new Float32Array(N);
    const r = rng(3);
    for (let i = 0; i < N; i++) x[i] = 0.001 * (r() * 2 - 1);
    const a = analyzeFrame(x, SR);
    expect(a.gateOpen).toBe(false);
    expect(a.matches.length).toBe(0);
  });
  it('bruit blanc seul (fort) → confiance basse', () => {
    const x = new Float32Array(N);
    const r = rng(5);
    for (let i = 0; i < N; i++) x[i] = 0.1 * (r() * 2 - 1);
    expect(analyzeFrame(x, SR).confidence).toBeLessThan(0.45);
  });
});

describe('cohabitation avec le métronome', () => {
  /** Ajoute des « bips » de métronome (sinus 880 Hz = un La5, 60 ms) aux instants donnés (s). */
  function addBeeps(x: Float32Array, times: number[], freq = 880): void {
    for (const t0 of times) {
      const i0 = Math.round(t0 * SR);
      for (let i = 0; i < 0.06 * SR; i++) {
        const k = i0 + i;
        if (k < 0 || k >= x.length) continue;
        x[k]! += 0.6 * Math.exp(-i / (0.02 * SR)) * Math.sin((2 * Math.PI * freq * i) / SR);
      }
    }
  }
  /** Signal long (0,5 s) : on y découpe la fenêtre d'analyse. */
  function longChord(c: Chord, seed: number): Float32Array {
    const parts = [0, 1, 2].map((k) => synthChord(voicing(c), { seed: seed + k, offset: k * N }));
    const out = new Float32Array(3 * N);
    parts.forEach((p, k) => out.set(p, k * N));
    return out;
  }
  // Seuls les accords sans La : le bip à 880 Hz ajoute un La, ce qui fausse leur détection.
  const noA = triads.filter((c) => !chordPitchClasses(c).includes(9));

  const ext = { ...DEFAULT_ANALYZE, qualities: ALL_QUALITIES };
  it('majeur/mineur seulement : un bip ne suffit pas à tromper la détection', () => {
    for (const c of noA) {
      const x = synthChord(voicing(c), { seed: c.root + 11 });
      addBeeps(x, [0.03, 0.1]);
      expect(chordId(analyzeFrame(x, SR).matches[0]!.chord)).toBe(chordId(c));
    }
  });
  it('accords étendus activés : sans protection, le bip (un La) fausse la détection', () => {
    let wrong = 0;
    for (const c of noA) {
      const x = synthChord(voicing(c), { seed: c.root + 11 });
      addBeeps(x, [0.03, 0.1]);
      if (chordId(analyzeFrame(x, SR, ext).matches[0]!.chord) !== chordId(c)) wrong++;
    }
    expect(wrong).toBeGreaterThan(0);
  });
  it('fenêtre propre (sans clic) → tous les accords reconnus, recul < 100 ms', () => {
    const total = 3 * N;
    const endTime = (total - 1) / SR;
    for (const c of triads) {
      const x = longChord(c, c.root * 5 + 2);
      const beeps = [endTime - 0.04, endTime - 0.54 + 0.25]; // un clic tout récent, un plus ancien
      addBeeps(x, beeps);
      const gate = new ClickGate();
      beeps.forEach((t) => gate.add(t));
      const cleanEnd = gate.findCleanEnd(endTime, N / SR)!;
      expect(cleanEnd).not.toBeNull();
      expect(endTime - cleanEnd).toBeLessThan(0.1);
      const iEnd = Math.round(cleanEnd * SR);
      const frame = x.slice(iEnd - N + 1, iEnd + 1);
      expect(chordId(analyzeFrame(frame, SR).matches[0]!.chord), JSON.stringify(c)).toBe(chordId(c));
      expect(chordId(analyzeFrame(frame, SR, ext).matches[0]!.chord), 'étendus ' + JSON.stringify(c)).toBe(chordId(c));
    }
  });
  it('clics trop rapprochés → pas de fenêtre propre (repli sur le masque)', () => {
    const gate = new ClickGate();
    for (let t = 0; t < 1; t += 0.1) gate.add(t);
    expect(gate.findCleanEnd(1, N / SR)).toBeNull();
  });
  it('le masque ne touche que la zone autour du clic', () => {
    const x = new Float32Array(4800).fill(1); // 100 ms
    const gate = new ClickGate({ before: 0.01, after: 0.02, fade: 0.001 });
    gate.add(0.05);
    gate.apply(x, SR, 4799 / SR);
    expect(x[Math.round(0.05 * SR)]).toBe(0);
    expect(x[Math.round(0.02 * SR)]).toBe(1);
    expect(x[Math.round(0.09 * SR)]).toBe(1);
  });
  it('pas de clic dans la fenêtre → signal intact', () => {
    const x = new Float32Array(100).fill(0.5);
    const gate = new ClickGate();
    gate.add(10);
    expect(gate.apply(x, SR, 1)).toBe(0);
    expect(x.every((v) => v === 0.5)).toBe(true);
  });
});

describe('stabilisation (hystérésis)', () => {
  const C = chord(0), G = chord(7);
  it('un accord doit rester stable ~350 ms avant d’être affiché', () => {
    const s = new ChordStabilizer({ holdMs: 350, minConfidence: 0.45 });
    expect(s.update(C, 0.9, 0).current).toBeNull();
    expect(s.update(C, 0.9, 200).current).toBeNull();
    const r = s.update(C, 0.9, 360);
    expect(r.current && chordId(r.current)).toBe('0:maj');
    expect(r.changed).toBe(true);
  });
  it('pas de clignotement si le signal hésite', () => {
    const s = new ChordStabilizer({ holdMs: 350, minConfidence: 0.45 });
    for (let t = 0; t <= 400; t += 50) s.update(C, 0.9, t);
    for (let t = 450; t < 2000; t += 50) {
      const r = s.update(t % 100 === 0 ? G : C, 0.9, t);
      expect(r.current && chordId(r.current)).toBe('0:maj');
    }
  });
  it('confiance trop basse → « … » après le délai, dernier accord conservé', () => {
    const s = new ChordStabilizer({ holdMs: 300, minConfidence: 0.45 });
    for (let t = 0; t <= 400; t += 50) s.update(C, 0.9, t);
    s.update(G, 0.2, 450);
    const r = s.update(G, 0.2, 800);
    expect(r.current).toBeNull();
    expect(r.last && chordId(r.last)).toBe('0:maj');
  });
  it('changement d’accord franc → nouvel accord en moins d’une seconde', () => {
    const s = new ChordStabilizer({ holdMs: 350, minConfidence: 0.45 });
    for (let t = 0; t <= 400; t += 50) s.update(C, 0.9, t);
    let shownAt = -1;
    for (let t = 450; t < 2000; t += 50) {
      const r = s.update(G, 0.9, t);
      if (r.current && chordId(r.current) === '7:maj' && shownAt < 0) shownAt = t;
    }
    expect(shownAt - 450).toBeLessThan(1000);
  });
});
