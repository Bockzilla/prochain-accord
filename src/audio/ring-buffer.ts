/**
 * Tampon circulaire d'échantillons horodatés par leur numéro absolu (frame audio).
 * Le numéro de frame vient de l'AudioWorklet (currentFrame) : même horloge que le métronome.
 */
export class RingBuffer {
  private buf: Float32Array;
  private mask: number;
  /** Nombre total d'échantillons écrits depuis le début = numéro de la prochaine frame. */
  private written = 0;
  private firstFrame = 0;

  constructor(capacityPow2 = 1 << 15) {
    if (capacityPow2 & (capacityPow2 - 1)) throw new Error('capacité non puissance de 2');
    this.buf = new Float32Array(capacityPow2);
    this.mask = capacityPow2 - 1;
  }

  /** Écrit un bloc dont le PREMIER échantillon porte le numéro `startFrame`. */
  write(chunk: Float32Array, startFrame: number): void {
    if (this.written === 0) this.firstFrame = startFrame;
    // Trou éventuel (bloc perdu) : on remplit de silence pour garder l'horodatage exact.
    const expected = this.firstFrame + this.written;
    if (startFrame > expected) {
      const gap = Math.min(startFrame - expected, this.buf.length);
      for (let i = 0; i < gap; i++) this.buf[(this.written + i) & this.mask] = 0;
      this.written += startFrame - expected;
    }
    for (let i = 0; i < chunk.length; i++) this.buf[(this.written + i) & this.mask] = chunk[i]!;
    this.written += chunk.length;
  }

  /** Numéro de frame du dernier échantillon écrit (ou -1). */
  get lastFrame(): number {
    return this.written === 0 ? -1 : this.firstFrame + this.written - 1;
  }

  /** Lit `n` échantillons dont le dernier porte le numéro `endFrame` ; null si indisponible. */
  read(n: number, endFrame: number): Float32Array | null {
    const endIdx = endFrame - this.firstFrame; // index relatif du dernier échantillon
    if (endIdx >= this.written || endIdx - n + 1 < 0 || this.written - endIdx + n > this.buf.length) return null;
    const out = new Float32Array(n);
    const start = endIdx - n + 1;
    for (let i = 0; i < n; i++) out[i] = this.buf[(start + i) & this.mask]!;
    return out;
  }
}
