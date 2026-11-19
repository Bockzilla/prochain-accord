import { freqToMidi } from '../theory/notes';
import type { PitchResult } from './pitch';

/**
 * Suivi de la note jouée en improvisation (monophonique) — PUR.
 * Une note n'est annoncée qu'après 2 mesures concordantes (même demi-ton, ±40 cents),
 * puis tenue tant que le signal reste net ; un accord ou du bruit ne produit rien.
 */
export interface PlayedNote {
  midi: number;
  cents: number;
  freq: number;
  /** Instant d'apparition (ms). */
  since: number;
}

export interface NoteTrackerOptions {
  minClarity: number;
  minRms: number;
  /** Mesures concordantes avant d'annoncer une note. */
  confirm: number;
  /** Durée sans mesure valable avant d'effacer la note (ms). */
  releaseMs: number;
}

export const DEFAULT_NOTE_TRACKER: NoteTrackerOptions = { minClarity: 0.86, minRms: 0.004, confirm: 2, releaseMs: 220 };

export class NoteTracker {
  private candidate: number | null = null;
  private count = 0;
  private current: PlayedNote | null = null;
  private lastValid = 0;

  constructor(
    public a4 = 440,
    private opts: NoteTrackerOptions = DEFAULT_NOTE_TRACKER,
  ) {}

  update(p: PitchResult | null, nowMs: number): PlayedNote | null {
    const valid = !!p && p.clarity >= this.opts.minClarity && p.rms >= this.opts.minRms && Number.isFinite(p.freq);
    if (!valid) {
      if (this.current && nowMs - this.lastValid > this.opts.releaseMs) this.current = null;
      this.candidate = null;
      this.count = 0;
      return this.current;
    }
    const m = freqToMidi(p.freq, this.a4);
    const midi = Math.round(m);
    const cents = Math.round((m - midi) * 100);
    this.lastValid = nowMs;
    if (Math.abs(m - midi) > 0.4) return this.current; // entre deux notes (glissando) : on attend
    if (midi === this.candidate) this.count++;
    else {
      this.candidate = midi;
      this.count = 1;
    }
    if (this.count >= this.opts.confirm) {
      if (!this.current || this.current.midi !== midi) this.current = { midi, cents, freq: p.freq, since: nowMs };
      else this.current = { ...this.current, cents, freq: p.freq };
    }
    return this.current;
  }

  reset(): void {
    this.candidate = null;
    this.count = 0;
    this.current = null;
  }
}
