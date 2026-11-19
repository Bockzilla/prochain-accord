/**
 * AudioWorklet de capture : regroupe les blocs de 128 échantillons du micro
 * et les envoie au thread principal avec leur numéro de frame exact (currentFrame).
 * Aucun traitement ici, aucune donnée ne sort de l'appareil.
 */
declare const currentFrame: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const BLOCK = 1024;

class CaptureProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(BLOCK);
  private fill = 0;
  private startFrame = 0;

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    if (this.fill === 0) this.startFrame = currentFrame;
    this.buf.set(ch, this.fill);
    this.fill += ch.length;
    if (this.fill >= BLOCK) {
      this.port.postMessage({ frame: this.startFrame, samples: this.buf }, [this.buf.buffer]);
      this.buf = new Float32Array(BLOCK);
      this.fill = 0;
    }
    return true;
  }
}

registerProcessor('pa-capture', CaptureProcessor);
