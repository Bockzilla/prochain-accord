import { midiToFreq } from '../theory/notes';
import type { NoteEvent } from './arranger';

/**
 * Orchestre synthétisé (Web Audio, aucun fichier son) : batterie, basse, accords.
 * Chaque source lancée est suivie ; stopAll() coupe et débranche tout ce qui reste,
 * et chaque source se débranche d'elle-même à la fin (pas de fuite de nœuds audio).
 */
type Ctx = Pick<BaseAudioContext, 'currentTime' | 'sampleRate' | 'createGain' | 'createOscillator' | 'createBiquadFilter' | 'createBufferSource' | 'createBuffer'>;

export interface BandVolumes {
  drums: number;
  comp: number;
}

export class BandVoice {
  private active = new Map<AudioScheduledSourceNode, AudioNode[]>();
  /** Nœuds créés pour la note en cours de construction (débranchés avec leur source). */
  private chain: AudioNode[] = [];
  private noise: AudioBuffer;
  readonly drums: GainNode;
  readonly comp: GainNode;

  constructor(
    private readonly ctx: Ctx,
    out: AudioNode,
  ) {
    this.drums = ctx.createGain();
    this.comp = ctx.createGain();
    this.drums.connect(out);
    this.comp.connect(out);
    const len = Math.floor(ctx.sampleRate * 0.25);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < len; i++) d[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  }

  setVolumes(v: BandVolumes): void {
    this.drums.gain.value = Math.max(0, Math.min(1, v.drums));
    this.comp.gain.value = Math.max(0, Math.min(1, v.comp)) * 0.8;
  }

  /** Nombre de sources encore actives (pour les tests de fuite). */
  get activeSources(): number {
    return this.active.size;
  }

  play(e: NoteEvent): void {
    const t = Math.max(e.time, this.ctx.currentTime);
    switch (e.part) {
      case 'kick': {
        const o = this.ctx.createOscillator();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        this.start(o, this.env(this.drums, t, 0.22, e.vel * 0.9), t, 0.25);
        break;
      }
      case 'snare': {
        const n = this.noiseSource(t);
        const f = this.track(this.ctx.createBiquadFilter());
        f.type = 'highpass';
        f.frequency.value = 1500;
        n.connect(f);
        f.connect(this.env(this.drums, t, 0.14, e.vel * 0.45));
        this.start(n, null, t, 0.16);
        const o = this.ctx.createOscillator();
        o.frequency.value = 190;
        this.start(o, this.env(this.drums, t, 0.08, e.vel * 0.3), t, 0.1);
        break;
      }
      case 'hat': {
        const n = this.noiseSource(t);
        const f = this.track(this.ctx.createBiquadFilter());
        f.type = 'highpass';
        f.frequency.value = 8000;
        n.connect(f);
        f.connect(this.env(this.drums, t, 0.04, e.vel * 0.35));
        this.start(n, null, t, 0.06);
        break;
      }
      case 'bass': {
        const m = e.midi[0];
        if (m === undefined) break;
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midiToFreq(m);
        const lp = this.track(this.ctx.createBiquadFilter());
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        o.connect(lp);
        lp.connect(this.env(this.comp, t, Math.max(0.12, e.dur), e.vel * 0.55));
        this.start(o, null, t, Math.max(0.12, e.dur) + 0.02);
        break;
      }
      case 'chord': {
        e.midi.forEach((m, i) => {
          const tt = t + i * e.strum;
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midiToFreq(m);
          const lp = this.track(this.ctx.createBiquadFilter());
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(2200, tt);
          lp.frequency.exponentialRampToValueAtTime(700, tt + Math.max(0.1, e.dur));
          o.connect(lp);
          lp.connect(this.env(this.comp, tt, Math.max(0.1, e.dur), (e.vel * 0.16) / Math.sqrt(e.midi.length)));
          this.start(o, null, tt, Math.max(0.1, e.dur) + 0.02);
        });
        break;
      }
    }
  }

  private noiseSource(t: number): AudioBufferSourceNode {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.playbackRate.setValueAtTime(1, t);
    return n;
  }

  private env(dest: AudioNode, t: number, dur: number, level: number): GainNode {
    const g = this.track(this.ctx.createGain());
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    return g;
  }

  private track<T extends AudioNode>(n: T): T {
    this.chain.push(n);
    return n;
  }

  private release(src: AudioScheduledSourceNode): void {
    const chain = this.active.get(src) ?? [];
    this.active.delete(src);
    src.onended = null;
    src.disconnect();
    for (const n of chain) n.disconnect();
  }

  private start(src: AudioScheduledSourceNode, to: AudioNode | null, t: number, dur: number): void {
    if (to) src.connect(to);
    this.active.set(src, this.chain);
    this.chain = [];
    src.onended = () => this.release(src);
    src.start(t);
    src.stop(t + dur);
  }

  /** Arrêt immédiat : coupe les notes déjà planifiées et libère tous les nœuds. */
  stopAll(): void {
    for (const s of [...this.active.keys()]) {
      try {
        s.stop();
      } catch {
        /* déjà arrêtée */
      }
      this.release(s);
    }
  }
}
