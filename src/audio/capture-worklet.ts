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
  /** -1 = mélange des canaux ; 0 / 1 = canal 1 / 2 d'une interface audio. */
  private channel = -1;
  private mix = new Float32Array(128);

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ channel?: unknown }>) => {
      // Messages du port du worklet : origine vide (même contexte). Toute autre origine est refusée.
      if (e.origin !== '') return;
      const c = e.data?.channel;
      if (c === -1 || c === 0 || c === 1) this.channel = c;
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const chans = inputs[0];
    if (!chans || chans.length === 0) return true;
    let ch: Float32Array;
    if (this.channel >= 0 && chans[this.channel]) {
      ch = chans[this.channel]!;
    } else if (chans.length === 1) {
      ch = chans[0]!;
    } else {
      if (this.mix.length !== chans[0]!.length) this.mix = new Float32Array(chans[0]!.length);
      for (let i = 0; i < this.mix.length; i++) this.mix[i] = 0.5 * (chans[0]![i]! + chans[1]![i]!);
      ch = this.mix;
    }
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
