/**
 * Masquage des clics du métronome dans le signal du micro.
 * On connaît l'heure exacte de chaque clic : on remplace par du silence (avec fondu court)
 * les échantillons proches de chaque clic AVANT l'analyse, au lieu d'espérer que la
 * détection ne se trompe pas.
 */
export interface ClickWindow {
  /** Heure (s, horloge audio) à laquelle le clic arrive au micro. */
  time: number;
}

export interface GateOptions {
  before: number; // s
  after: number; // s
  fade: number; // s
}

export const DEFAULT_GATE: GateOptions = { before: 0.015, after: 0.045, fade: 0.004 };

export class ClickGate {
  private clicks: number[] = [];
  constructor(public opts: GateOptions = DEFAULT_GATE) {}

  add(time: number): void {
    this.clicks.push(time);
    if (this.clicks.length > 256) this.clicks.splice(0, this.clicks.length - 256);
  }

  clear(): void {
    this.clicks = [];
  }

  /**
   * Stratégie principale : trouve la fin de la fenêtre d'analyse la plus récente
   * (durée `frameDur`) qui ne chevauche AUCUN clic, en reculant au plus de `maxLookback`.
   * Retourne null si aucune fenêtre propre (clics trop rapprochés) → repli sur apply().
   */
  findCleanEnd(bufferEnd: number, frameDur: number, maxLookback = 0.25): number | null {
    let end = bufferEnd;
    for (let guard = 0; guard < 64; guard++) {
      if (bufferEnd - end > maxLookback) return null;
      const start = end - frameDur;
      let moved = false;
      for (const c of this.clicks) {
        const a = c - this.opts.before;
        const b = c + this.opts.after;
        if (b > start && a < end) {
          end = Math.min(end, a);
          moved = true;
        }
      }
      if (!moved) return end;
    }
    return null;
  }

  /**
   * Repli : applique le masque sur `buf` dont le DERNIER échantillon a l'heure `endTime`.
   * Retourne la fraction d'échantillons masqués (0..1).
   */
  apply(buf: Float32Array | Float64Array, sampleRate: number, endTime: number): number {
    const n = buf.length;
    const startTime = endTime - (n - 1) / sampleRate;
    const gain = new Float32Array(n).fill(1);
    const fadeN = Math.max(1, Math.round(this.opts.fade * sampleRate));
    let any = false;
    for (const c of this.clicks) {
      const a = c - this.opts.before;
      const b = c + this.opts.after;
      if (b < startTime || a > endTime) continue;
      any = true;
      const ia = Math.round((a - startTime) * sampleRate);
      const ib = Math.round((b - startTime) * sampleRate);
      for (let i = Math.max(0, ia - fadeN); i < Math.min(n, ib + fadeN); i++) {
        let g = 0;
        if (i < ia) g = (ia - i) / fadeN;
        else if (i >= ib) g = (i - ib) / fadeN;
        gain[i] = Math.min(gain[i]!, Math.max(0, Math.min(1, g)));
      }
    }
    if (!any) return 0;
    let masked = 0;
    for (let i = 0; i < n; i++) {
      buf[i] = buf[i]! * gain[i]!;
      if (gain[i]! < 0.5) masked++;
    }
    // Oublier les clics trop anciens.
    this.clicks = this.clicks.filter((c) => c + this.opts.after + 1 > startTime);
    return masked / n;
  }
}
