import { freqToMidi, mod12 } from '../theory/notes';

export interface ChromaOptions {
  a4: number;
  fmin: number;
  fmax: number;
}

export const DEFAULT_CHROMA: ChromaOptions = { a4: 440, fmin: 70, fmax: 2500 };

interface Peak {
  freq: number;
  amp: number;
}

/** Pics locaux du spectre, avec fréquence affinée par interpolation parabolique. */
export function spectralPeaks(mag: Float64Array, sampleRate: number, opts: ChromaOptions): Peak[] {
  const n = mag.length * 2;
  const binHz = sampleRate / n;
  const kmin = Math.max(2, Math.floor(opts.fmin / binHz));
  const kmax = Math.min(mag.length - 2, Math.ceil(opts.fmax / binHz));
  let maxAmp = 0;
  for (let k = kmin; k <= kmax; k++) maxAmp = Math.max(maxAmp, mag[k]!);
  const floor = maxAmp * 0.02;
  const peaks: Peak[] = [];
  for (let k = kmin; k <= kmax; k++) {
    const a = mag[k - 1]!;
    const b = mag[k]!;
    const c = mag[k + 1]!;
    if (b > a && b >= c && b > floor) {
      const den = a - 2 * b + c;
      const delta = den !== 0 ? (0.5 * (a - c)) / den : 0;
      peaks.push({ freq: (k + delta) * binHz, amp: b - 0.25 * (a - c) * delta });
    }
  }
  return peaks;
}

/**
 * Chromagramme 12 notes à partir d'un spectre d'amplitude.
 * - seuls les pics comptent (moins sensible au bruit large bande) ;
 * - un pic qui est l'harmonique 2..6 d'un pic plus grave est atténué
 *   (sinon la quinte et la tierce « fantômes » des harmoniques faussent l'accord) ;
 * - compression logarithmique pour que les notes faibles comptent aussi.
 */
export function computeChroma(mag: Float64Array, sampleRate: number, opts: ChromaOptions = DEFAULT_CHROMA): Float64Array {
  const peaks = spectralPeaks(mag, sampleRate, opts);
  const chroma = new Float64Array(12);
  if (peaks.length === 0) return chroma;
  const maxAmp = Math.max(...peaks.map((p) => p.amp));
  for (const p of peaks) {
    const midi = freqToMidi(p.freq, opts.a4);
    const nearest = Math.round(midi);
    const dev = Math.abs(midi - nearest); // 0..0.5 demi-ton
    if (dev > 0.35) continue; // entre deux notes : probablement du bruit
    let weight = 1;
    for (let h = 2; h <= 6; h++) {
      const f0 = p.freq / h;
      if (f0 < opts.fmin * 0.9) break;
      if (peaks.some((q) => Math.abs(q.freq - f0) / f0 < 0.03 && q.amp > p.amp * 0.15)) {
        weight *= h === 2 || h === 4 ? 0.6 : 0.35; // octaves : même classe, on atténue moins
        break;
      }
    }
    const v = Math.log1p((20 * p.amp) / maxAmp) * weight * (1 - dev);
    chroma[mod12(nearest)]! += v;
  }
  const max = Math.max(...chroma);
  if (max > 0) for (let i = 0; i < 12; i++) chroma[i]! /= max;
  return chroma;
}

/**
 * Classe de hauteur de la note la plus grave clairement présente (la « basse »),
 * ou -1 si aucune. Sert à départager les accords aux mêmes notes (Csus2 = Gsus4).
 */
export function bassPitchClass(mag: Float64Array, sampleRate: number, opts: ChromaOptions = DEFAULT_CHROMA): number {
  const peaks = spectralPeaks(mag, sampleRate, { ...opts, fmax: Math.min(opts.fmax, 400) });
  if (peaks.length === 0) return -1;
  const maxAmp = Math.max(...peaks.map((p) => p.amp));
  const low = peaks.find((p) => p.amp > maxAmp * 0.3);
  if (!low) return -1;
  const midi = freqToMidi(low.freq, opts.a4);
  return Math.abs(midi - Math.round(midi)) > 0.35 ? -1 : mod12(Math.round(midi));
}

export function rms(samples: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i]! * samples[i]!;
  return Math.sqrt(s / Math.max(1, samples.length));
}
