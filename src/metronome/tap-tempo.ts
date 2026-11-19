/**
 * TAP tempo — PUR. Les temps sont en secondes (performance.now()/1000 ou horloge audio).
 * - BPM affiché dès le 2e tap, affiné ensuite (moyenne des 4 à 8 derniers intervalles) ;
 * - double tap accidentel (intervalle < 50 % de la médiane) ignoré ;
 * - intervalles aberrants (écart > 35 % de la médiane) exclus de la moyenne ;
 * - après 2 s sans tap, le calcul repart à zéro.
 */
export interface TapTempoOptions {
  maxIntervals?: number;
  resetAfter?: number;
  tolerance?: number;
}

export class TapTempo {
  private taps: number[] = [];
  private readonly maxIntervals: number;
  private readonly resetAfter: number;
  private readonly tolerance: number;

  constructor(opts: TapTempoOptions = {}) {
    this.maxIntervals = opts.maxIntervals ?? 8;
    this.resetAfter = opts.resetAfter ?? 2;
    this.tolerance = opts.tolerance ?? 0.35;
  }

  reset(): void {
    this.taps = [];
  }

  get tapCount(): number {
    return this.taps.length;
  }

  /** Enregistre un tap ; retourne le BPM estimé (null avant le 2e tap). */
  tap(t: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && t - last > this.resetAfter) this.taps = [];
    if (last !== undefined && t <= last) return this.bpm();

    const intervals = this.intervals();
    if (intervals.length >= 2 && last !== undefined) {
      const m = median(intervals);
      if (t - last < 0.5 * m) return this.bpm(); // double tap accidentel
    }
    this.taps.push(t);
    if (this.taps.length > this.maxIntervals + 1) this.taps.shift();
    return this.bpm();
  }

  private intervals(): number[] {
    const out: number[] = [];
    for (let i = 1; i < this.taps.length; i++) out.push(this.taps[i]! - this.taps[i - 1]!);
    return out;
  }

  bpm(): number | null {
    const iv = this.intervals();
    if (iv.length === 0) return null;
    let used = iv;
    if (iv.length >= 3) {
      const m = median(iv);
      const kept = iv.filter((x) => Math.abs(x - m) <= this.tolerance * m);
      if (kept.length > 0) used = kept;
    }
    const mean = used.reduce((s, x) => s + x, 0) / used.length;
    return 60 / mean;
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
