import type { SoundId } from './presets';
import type { TickEvent } from './scheduler';

/**
 * Sons du métronome, entièrement générés en Web Audio (aucun fichier externe).
 * Chaque son existe en 3 variantes : accent (plus aigu/fort), temps, subdivision (discret).
 */
export interface Volumes {
  accent: number;
  beat: number;
  sub: number;
}

export class MetronomeVoice {
  private noise: AudioBuffer;
  sound: SoundId = 'click';
  volumes: Volumes = { accent: 1, beat: 0.7, sub: 0.35 };

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
  ) {
    const len = Math.floor(ctx.sampleRate * 0.1);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Planifie le son d'un événement à son heure exacte (horloge audio). */
  play(ev: TickEvent, gain = 1): void {
    if (!ev.audible || gain <= 0) return;
    const level = gain * (ev.kind === 'accent' ? this.volumes.accent : ev.kind === 'sub' ? this.volumes.sub : this.volumes.beat * (ev.groupStart ? 1.1 : 1));
    if (level <= 0) return;
    const pitch = ev.kind === 'accent' ? 1.5 : ev.kind === 'sub' ? 0.8 : 1;
    const t = Math.max(ev.time, this.ctx.currentTime);
    switch (this.sound) {
      case 'click':
        this.tone(t, 1000 * pitch, 'square', 0.025, level * 0.35);
        break;
      case 'beep':
        this.tone(t, 880 * pitch, 'sine', 0.07, level * 0.8);
        break;
      case 'wood':
        this.tone(t, 1300 * pitch, 'sine', 0.035, level * 0.7);
        this.noiseHit(t, 'bandpass', 2200 * pitch, 0.02, level * 0.5);
        break;
      case 'hihat':
        this.noiseHit(t, 'highpass', 7000, ev.kind === 'accent' ? 0.09 : 0.04, level * 0.7);
        if (ev.kind === 'accent') this.tone(t, 180, 'sine', 0.08, level * 0.6);
        break;
    }
  }

  private envelope(t: number, dur: number, level: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out);
    return g;
  }

  private tone(t: number, freq: number, type: OscillatorType, dur: number, level: number): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(this.envelope(t, dur, level));
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, dur: number, level: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === 'bandpass' ? 4 : 0.7;
    src.connect(f);
    f.connect(this.envelope(t, dur, level));
    src.start(t);
    src.stop(t + dur + 0.01);
  }
}
