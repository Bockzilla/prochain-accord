import { midiToFreq } from '../theory/notes';
import type { AudioEngine } from './engine';

/**
 * Signal de test (mode débogage) : un accord synthétique envoyé dans la chaîne d'analyse,
 * pour vérifier la détection sans guitare. Optionnellement audible.
 */
export class TestSignal {
  private nodes: AudioScheduledSourceNode[] = [];
  private out: GainNode | null = null;
  private monitor: GainNode | null = null;

  constructor(private engine: AudioEngine) {}

  /** Note seule (accordeur, détection de notes) : `cents` = désaccord volontaire. */
  async playNote(midi: number, cents: number, audible: boolean): Promise<void> {
    await this.play([midi + cents / 100], audible);
  }

  async play(midis: number[], audible: boolean): Promise<void> {
    this.stop();
    const ctx = this.engine.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.15;
    await this.engine.connectToAnalysis(this.out);
    if (audible) {
      this.monitor = ctx.createGain();
      this.monitor.gain.value = 0.5;
      this.out.connect(this.monitor).connect(this.engine.master);
    }
    for (const m of midis) {
      [1, 0.5, 0.33, 0.2].forEach((amp, k) => {
        const o = ctx.createOscillator();
        o.frequency.value = midiToFreq(m) * (k + 1);
        const g = ctx.createGain();
        g.gain.value = amp / midis.length;
        o.connect(g).connect(this.out!);
        o.start();
        this.nodes.push(o);
      });
    }
  }

  stop(): void {
    this.nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* déjà arrêté */
      }
    });
    this.nodes = [];
    this.out?.disconnect();
    this.monitor?.disconnect();
    this.out = null;
    this.monitor = null;
  }

  get playing(): boolean {
    return this.nodes.length > 0;
  }
}
