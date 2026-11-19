import { sameChord, type Chord } from '../theory/chords';

export interface StabilizerOptions {
  /** Durée pendant laquelle un accord doit rester stable avant d'être validé (ms). */
  holdMs: number;
  /** En dessous de cette confiance, la trame compte comme « aucun accord ». */
  minConfidence: number;
}

export interface StableState {
  /** Accord affiché (null = « … »). */
  current: Chord | null;
  /** Dernier accord validé, conservé pendant les silences. */
  last: Chord | null;
  /** Vrai à l'instant où un NOUVEL accord est validé. */
  changed: boolean;
}

/**
 * Hystérésis : un candidat doit rester le même pendant `holdMs` pour remplacer l'affichage.
 * Évite le « clignotement » quand le signal hésite entre deux accords voisins.
 */
export class ChordStabilizer {
  private pending: Chord | null = null;
  private pendingSince = 0;
  private shown: Chord | null = null;
  private last: Chord | null = null;

  constructor(private opts: StabilizerOptions = { holdMs: 350, minConfidence: 0.45 }) {}

  setOptions(o: Partial<StabilizerOptions>): void {
    this.opts = { ...this.opts, ...o };
  }

  reset(): void {
    this.pending = null;
    this.shown = null;
    this.last = null;
  }

  update(candidate: Chord | null, conf: number, timeMs: number): StableState {
    const cand = candidate && conf >= this.opts.minConfidence ? candidate : null;
    const samePending = cand === null ? this.pending === null : sameChord(cand, this.pending);
    if (!samePending) {
      this.pending = cand;
      this.pendingSince = timeMs;
    }
    let changed = false;
    if (timeMs - this.pendingSince >= this.opts.holdMs) {
      const isNew = this.pending === null ? this.shown !== null : !sameChord(this.pending, this.shown);
      if (isNew) {
        this.shown = this.pending;
        if (this.pending) {
          changed = !sameChord(this.pending, this.last);
          this.last = this.pending;
        }
      }
    }
    return { current: this.shown, last: this.last, changed };
  }
}
