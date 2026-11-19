import { freqToMidi, midiToFreq } from '../theory/notes';
import type { PitchResult } from './pitch';

/** Accordeur — logique PURE (la mesure de hauteur vient de pitch.ts). */
export type TunerMode = 'guitar' | 'chromatic';

export const GUITAR_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

export interface TunerReading {
  freq: number;
  /** Note visée (MIDI). */
  target: number;
  /** Écart en cents par rapport à la note visée (−50..+50 en chromatique). */
  cents: number;
  /** Corde visée en mode guitare (0 = Mi grave), sinon null. */
  string: number | null;
  /** La lecture est stable (plusieurs mesures concordantes). */
  stable: boolean;
  /** Juste à ±5 cents, stable. */
  inTune: boolean;
}

export function centsBetween(freq: number, targetMidi: number, a4 = 440): number {
  return 1200 * Math.log2(freq / midiToFreq(targetMidi, a4));
}

/** Note visée : la plus proche (chromatique) ou la corde la plus proche (guitare). */
export function targetFor(freq: number, mode: TunerMode, a4 = 440): { target: number; string: number | null } {
  const midi = freqToMidi(freq, a4);
  if (mode === 'chromatic') return { target: Math.round(midi), string: null };
  let best = 0;
  for (let i = 1; i < GUITAR_STRINGS.length; i++) if (Math.abs(midi - GUITAR_STRINGS[i]!) < Math.abs(midi - GUITAR_STRINGS[best]!)) best = i;
  return { target: GUITAR_STRINGS[best]!, string: best };
}

export interface TunerOptions {
  /** Clarité minimale YIN. */
  minClarity: number;
  /** Niveau minimal. */
  minRms: number;
  /** Nombre de mesures concordantes avant d'afficher « stable ». */
  window: number;
  /** Dispersion maximale (cents) des dernières mesures pour être « stable ». */
  maxSpread: number;
}

export const DEFAULT_TUNER: TunerOptions = { minClarity: 0.85, minRms: 0.003, window: 5, maxSpread: 25 };

/**
 * Rejet des signaux instables : une lecture n'est affichée que si les dernières mesures
 * concordent (médiane, faible dispersion). L'aiguille est lissée (moyenne exponentielle).
 */
export class TunerStabilizer {
  private recent: number[] = []; // fréquences
  private smoothCents: number | null = null;
  private lastTarget = -1;

  constructor(
    public mode: TunerMode = 'guitar',
    public a4 = 440,
    private opts: TunerOptions = DEFAULT_TUNER,
  ) {}

  reset(): void {
    this.recent = [];
    this.smoothCents = null;
  }

  update(p: PitchResult | null): TunerReading | null {
    if (!p || p.clarity < this.opts.minClarity || p.rms < this.opts.minRms || !Number.isFinite(p.freq)) {
      this.recent = this.recent.slice(1); // le signal s'éteint : on oublie progressivement
      if (this.recent.length === 0) this.smoothCents = null;
      return null;
    }
    this.recent.push(p.freq);
    if (this.recent.length > this.opts.window) this.recent.shift();
    const sorted = [...this.recent].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const { target, string } = targetFor(median, this.mode, this.a4);
    const centsList = this.recent.map((f) => centsBetween(f, target, this.a4));
    const spread = Math.max(...centsList) - Math.min(...centsList);
    const cents = centsBetween(median, target, this.a4);
    if (target !== this.lastTarget) this.smoothCents = null;
    this.lastTarget = target;
    this.smoothCents = this.smoothCents === null ? cents : this.smoothCents * 0.6 + cents * 0.4;
    const stable = this.recent.length >= Math.min(3, this.opts.window) && spread <= this.opts.maxSpread;
    return { freq: median, target, cents: this.smoothCents, string, stable, inTune: stable && Math.abs(this.smoothCents) <= 5 };
  }
}
