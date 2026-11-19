import { clampBpm, defaultBeatStates, groupStarts, type BeatState, type Subdivision, type TimeSignature, SIGNATURES } from './meter';
import { acceleratedBpm, isSilentBar, type AcceleratorConfig, type SilentBarsConfig } from './training';

/**
 * Planificateur du métronome — indépendant du navigateur (horloge injectée).
 *
 * Principe « lookahead » : un réveil régulier (toutes les ~25 ms) appelle tick(),
 * qui planifie à l'avance tous les clics tombant dans les 100 prochaines ms,
 * à l'heure EXACTE de l'horloge audio. Le réveil peut être irrégulier : ça ne change
 * jamais l'heure des clics, seulement le moment où on les prépare.
 *
 * Zéro dérive : l'heure d'un temps est calculée par multiplication
 * (début du segment + k × période), jamais par additions successives.
 */
export interface Clock {
  /** Secondes, même horloge que celle qui joue les sons (AudioContext.currentTime). */
  now(): number;
}

export type TickKind = 'accent' | 'normal' | 'sub';

export interface TickEvent {
  time: number;
  /** Mesure : négative pendant le décompte (-2, -1), puis 0, 1, 2… */
  bar: number;
  beat: number;
  /** 0 = le temps lui-même, 1.. = subdivisions. */
  sub: number;
  kind: TickKind;
  state: BeatState;
  groupStart: boolean;
  audible: boolean;
  /** Vrai si le réveil est arrivé trop tard (page gelée) : le clic n'est pas joué. */
  late: boolean;
  countIn: boolean;
  bpm: number;
  beatsPerBar: number;
}

export interface MetronomeConfig {
  bpm: number;
  signature: TimeSignature;
  beatStates: BeatState[];
  subdivision: Subdivision;
  countInBars: 0 | 1 | 2;
  accelerator: AcceleratorConfig;
  silent: SilentBarsConfig;
}

export function defaultConfig(): MetronomeConfig {
  const signature = SIGNATURES.find((s) => s.id === '4/4')!;
  return {
    bpm: 100,
    signature,
    beatStates: defaultBeatStates(signature),
    subdivision: 1,
    countInBars: 0,
    accelerator: { enabled: false, stepBpm: 5, everyBars: 4, targetBpm: 160 },
    silent: { enabled: false, playBars: 2, muteBars: 2 },
  };
}

export class MetronomeScheduler {
  readonly lookahead: number;
  /** Un clic planifié plus de `lateTolerance` s après son heure est rendu muet (pas de rafale au réveil). */
  readonly lateTolerance: number;
  private cfg: MetronomeConfig;
  private running = false;
  // Segment de tempo courant : temps n ↦ segStart + (n - segBeat) × period
  private segStart = 0;
  private segBeat = 0;
  private period = 0.6;
  private currentBpm = 100;
  // Prochain événement à planifier
  private beatIndex = 0;
  private sub = 0;
  private bar = 0;
  private beatInBar = 0;
  private accelOrigin = 0;
  private listeners: ((e: TickEvent) => void)[] = [];

  constructor(
    private readonly clock: Clock,
    config: Partial<MetronomeConfig> = {},
    opts: { lookahead?: number; lateTolerance?: number } = {},
  ) {
    const base = { ...defaultConfig(), ...config };
    if (!config.beatStates || config.beatStates.length !== base.signature.beats) {
      base.beatStates = defaultBeatStates(base.signature);
    }
    this.cfg = base;
    this.lookahead = opts.lookahead ?? 0.1;
    this.lateTolerance = opts.lateTolerance ?? 0.02;
  }

  onTick(fn: (e: TickEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  get isRunning(): boolean {
    return this.running;
  }

  get config(): Readonly<MetronomeConfig> {
    return this.cfg;
  }

  get bpmNow(): number {
    return this.currentBpm;
  }

  start(delay = 0.06): number {
    this.running = true;
    this.segStart = this.clock.now() + delay;
    this.segBeat = 0;
    this.currentBpm = clampBpm(this.cfg.bpm);
    this.period = 60 / this.currentBpm;
    this.beatIndex = 0;
    this.sub = 0;
    this.bar = this.cfg.countInBars > 0 ? -this.cfg.countInBars : 0;
    this.beatInBar = 0;
    this.accelOrigin = 0;
    this.tick();
    return this.segStart;
  }

  stop(): void {
    this.running = false;
  }

  /** Change la configuration ; le tempo s'applique au début du prochain temps non planifié. */
  update(partial: Partial<MetronomeConfig>): void {
    if (partial.bpm !== undefined) {
      partial.bpm = clampBpm(partial.bpm);
      if (partial.bpm !== this.cfg.bpm) this.accelOrigin = Math.max(0, this.bar);
    }
    if (partial.signature && !partial.beatStates && partial.signature.beats !== this.cfg.beatStates.length) {
      partial.beatStates = defaultBeatStates(partial.signature);
    }
    this.cfg = { ...this.cfg, ...partial };
    if (this.beatInBar >= this.cfg.signature.beats) {
      this.beatInBar = 0;
      this.bar++;
    }
  }

  private beatTime(n: number): number {
    return this.segStart + (n - this.segBeat) * this.period;
  }

  private targetBpm(): number {
    const base = clampBpm(this.cfg.bpm);
    if (this.bar < 0) return base;
    return clampBpm(acceleratedBpm(base, this.cfg.accelerator, this.bar - this.accelOrigin));
  }

  /** À appeler régulièrement (≈ toutes les 25 ms). Planifie tout ce qui tombe dans la fenêtre. */
  tick(): void {
    if (!this.running) return;
    const now = this.clock.now();
    const horizon = now + this.lookahead;
    for (;;) {
      const countIn = this.bar < 0;
      const subdiv = countIn ? 1 : this.cfg.subdivision;
      // Début d'un temps : appliquer un changement de tempo éventuel, sans coupure.
      if (this.sub === 0) {
        const want = this.targetBpm();
        if (want !== this.currentBpm) {
          const t = this.beatTime(this.beatIndex);
          this.segStart = t;
          this.segBeat = this.beatIndex;
          this.currentBpm = want;
          this.period = 60 / want;
        }
      }
      const time = this.beatTime(this.beatIndex) + (this.sub * this.period) / subdiv;
      if (time >= horizon) break;
      this.emit(time, countIn, time < now - this.lateTolerance);
      this.sub++;
      if (this.sub >= subdiv) {
        this.sub = 0;
        this.beatIndex++;
        this.beatInBar++;
        if (this.beatInBar >= this.cfg.signature.beats) {
          this.beatInBar = 0;
          this.bar++;
        }
      }
    }
  }

  private emit(time: number, countIn: boolean, late: boolean): void {
    const sig = this.cfg.signature;
    const state: BeatState = countIn
      ? this.beatInBar === 0 ? 'accent' : 'normal'
      : this.cfg.beatStates[this.beatInBar] ?? 'normal';
    const silent = !countIn && isSilentBar(this.cfg.silent, this.bar);
    const kind: TickKind = this.sub > 0 ? 'sub' : state === 'accent' ? 'accent' : 'normal';
    const ev: TickEvent = {
      time,
      bar: this.bar,
      beat: this.beatInBar,
      sub: this.sub,
      kind,
      state,
      groupStart: groupStarts(sig).has(this.beatInBar),
      audible: !silent && state !== 'mute' && !late,
      late,
      countIn,
      bpm: this.currentBpm,
      beatsPerBar: sig.beats,
    };
    for (const l of this.listeners) l(ev);
  }
}
