/**
 * Détection de hauteur monophonique — algorithme YIN (de Cheveigné & Kawahara, 2002), code maison, PUR.
 * Sert à l'accordeur et à la détection des notes jouées en improvisation.
 * Une seule note à la fois : sur un accord, la « clarté » chute et le résultat est rejeté.
 */
export interface PitchOptions {
  fmin: number;
  fmax: number;
  /** Seuil YIN (plus bas = plus strict). */
  threshold: number;
}

export const DEFAULT_PITCH: PitchOptions = { fmin: 60, fmax: 1400, threshold: 0.15 };

export interface PitchResult {
  freq: number;
  /** 0..1 : 1 = période parfaitement nette. */
  clarity: number;
  rms: number;
}

export function yinPitch(input: Float32Array | Float64Array, inputRate: number, opts: PitchOptions = DEFAULT_PITCH): PitchResult | null {
  // Décimation par 2 au-delà de 32 kHz : les notes de guitare restent sous 1,4 kHz,
  // et le calcul (quadratique) devient environ 4 fois moins coûteux (batterie).
  let x: Float32Array | Float64Array = input;
  let sampleRate = inputRate;
  if (inputRate > 32000) {
    const half = new Float64Array(input.length >> 1);
    for (let i = 0; i < half.length; i++) half[i] = 0.5 * (input[2 * i]! + input[2 * i + 1]!);
    x = half;
    sampleRate = inputRate / 2;
  }
  const n = x.length;
  let rmsAcc = 0;
  for (let i = 0; i < n; i++) rmsAcc += x[i]! * x[i]!;
  const rms = Math.sqrt(rmsAcc / Math.max(1, n));
  const tauMin = Math.max(2, Math.floor(sampleRate / opts.fmax));
  const tauMax = Math.min(Math.floor(sampleRate / opts.fmin), Math.floor(n / 2) - 1);
  if (tauMax <= tauMin + 2) return null;
  const w = n - tauMax;
  const d = new Float64Array(tauMax + 1);
  // Fonction de différence
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < w; i++) {
      const diff = x[i]! - x[i + tau]!;
      s += diff * diff;
    }
    d[tau] = s;
  }
  // Différence normalisée par la moyenne cumulée
  const cmnd = new Float64Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau]!;
    cmnd[tau] = running > 0 ? (d[tau]! * tau) / running : 1;
  }
  // Premier minimum sous le seuil (évite les erreurs d'octave vers le bas)
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t]! < opts.threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1]! < cmnd[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // Repli : minimum global, mais la clarté sera faible et le résultat sera rejeté en aval.
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cmnd[t]! < cmnd[best]!) best = t;
    tau = best;
  }
  // Interpolation parabolique pour une précision inférieure au cent
  let betterTau = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1]!;
    const b = cmnd[tau]!;
    const c = cmnd[tau + 1]!;
    const den = a + c - 2 * b;
    if (den !== 0) betterTau = tau + (a - c) / (2 * den);
  }
  return { freq: sampleRate / betterTau, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau]!)), rms };
}
