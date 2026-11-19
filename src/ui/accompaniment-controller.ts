import { arrangeBeat, chordForBar, type ArrangeContext } from '../accompaniment/arranger';
import { BandVoice } from '../accompaniment/band';
import type { AudioEngine } from '../audio/engine';
import type { Chord } from '../theory/chords';
import type { Key } from '../theory/keys';
import { PROGRESSIONS, progressionsFor, realizeProgression } from '../theory/harmony';
import type { MetronomeController } from './metronome-controller';
import type { Settings } from './settings';
import type { SharedMusic } from './shared';

export type BandState = 'stopped' | 'playing' | 'paused';

/**
 * Accompagnement branché sur le planificateur du métronome : même horloge, mêmes temps.
 * Lecture / pause (reprise à la même mesure) / arrêt.
 */
export class AccompanimentController {
  readonly band: BandVoice;
  state: BandState = 'stopped';
  private arr: ArrangeContext = { style: 'blues', loop: [], barOffset: 0 };
  /** Tonalité de la boucle (le mode vient de la progression choisie). */
  loopKey: Key = { tonic: 9, mode: 'major' };
  private resumeAt = 0;
  private lastBar = -1;
  /** Mesure en cours d'affichage (index dans la boucle) ; -1 pendant le décompte. */
  currentIndex = -1;
  countingIn = false;
  private listeners = new Set<() => void>();
  private stopping = false;

  constructor(
    engine: AudioEngine,
    private metro: MetronomeController,
    private settings: Settings,
    private shared: SharedMusic,
  ) {
    this.band = new BandVoice(engine.ctx, engine.master);
    metro.scheduler.onTick((e) => {
      if (this.state !== 'playing') return;
      if (e.sub === 0 && e.bar >= 0) this.lastBar = e.bar;
      for (const n of arrangeBeat(e, this.arr)) this.band.play(n);
    });
    metro.onVisual((e) => {
      if (this.state !== 'playing' || e.sub !== 0) return;
      this.countingIn = e.countIn;
      this.currentIndex = chordForBar(this.arr, e.bar)?.index ?? -1;
      this.emit();
    });
    // Si le métronome est arrêté ailleurs, l'accompagnement s'arrête aussi.
    metro.onState((running) => {
      if (!running && this.state === 'playing' && !this.stopping) this.finish('stopped');
    });
  }

  /** Boucle d'accords courante, transposée dans la tonalité partagée. */
  get loop(): Chord[] {
    return this.arr.loop;
  }

  refresh(): void {
    const m = this.settings.music;
    const tpl = PROGRESSIONS.find((p) => p.id === m.progressionId && p.style === m.style) ?? progressionsFor(m.style)[0]!;
    m.progressionId = tpl.id;
    // On garde la tonique partagée (« La » → blues en La) ; le mode vient de la progression choisie.
    const { key: lk, chords } = realizeProgression(tpl, this.shared.key.tonic);
    this.loopKey = lk;
    this.arr = { style: m.style, loop: chords, barOffset: this.arr.barOffset };
    this.band.setVolumes({ drums: m.volumes.drums, comp: m.volumes.comp });
    this.emit();
  }

  get tonicOfLoop(): number {
    return this.arr.loop[0]?.root ?? this.shared.key.tonic;
  }

  async play(): Promise<void> {
    if (this.state === 'playing') return;
    this.refresh();
    if (this.metro.running) {
      this.stopping = true;
      this.metro.stop();
      this.stopping = false;
    }
    this.arr.barOffset = this.state === 'paused' ? this.resumeAt : 0;
    this.lastBar = -1;
    this.metro.scheduler.update({ countInBars: this.settings.music.countIn });
    // Décompte toujours audible ; ensuite, le clic suit son propre volume (souvent coupé).
    this.metro.clickGain = (e) => (e.countIn ? 1 : this.settings.music.volumes.click);
    this.state = 'playing';
    this.countingIn = this.settings.music.countIn > 0;
    await this.metro.start();
    this.emit();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    const len = Math.max(1, this.arr.loop.length);
    this.resumeAt = this.lastBar >= 0 ? (this.arr.barOffset + this.lastBar + 1) % len : this.arr.barOffset;
    this.finish('paused');
  }

  stop(): void {
    this.resumeAt = 0;
    this.finish('stopped');
  }

  private finish(next: BandState): void {
    this.state = next;
    this.stopping = true;
    if (this.metro.running) this.metro.stop();
    this.stopping = false;
    this.band.stopAll();
    this.metro.clickGain = null;
    this.metro.apply(this.settings); // rétablit le décompte du métronome seul
    this.currentIndex = next === 'paused' ? this.resumeAt : -1;
    this.countingIn = false;
    this.emit();
  }

  on(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
