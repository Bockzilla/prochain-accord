import type { AudioEngine } from '../audio/engine';
import { customSignature, defaultBeatStates, groupStarts, signatureById, type BeatState, type TimeSignature } from '../metronome/meter';
import { MetronomeScheduler, type TickEvent } from '../metronome/scheduler';
import { MetronomeVoice } from '../metronome/sounds';
import { startTicker, type Ticker } from '../metronome/ticker';
import type { Settings } from './settings';

/**
 * Relie le planificateur (pur) au navigateur : horloge audio, sons, réveil en Worker,
 * file d'affichage synchronisée (requestAnimationFrame lit la MÊME horloge audio).
 */
export class MetronomeController {
  readonly scheduler: MetronomeScheduler;
  private voice: MetronomeVoice;
  private ticker: Ticker | null = null;
  private queue: TickEvent[] = [];
  private raf = 0;
  private visualListeners: ((e: TickEvent) => void)[] = [];
  private stateListeners: ((running: boolean) => void)[] = [];
  /** Appelé pour chaque clic audible, avec l'heure d'arrivée estimée au micro. */
  onClickAtMic: ((time: number) => void) | null = null;
  latencyMs = 0;
  vibrate = false;
  lastShown: TickEvent | null = null;
  /** Volume de chaque clic (ex. accompagnement : décompte audible puis clic réglable). null = normal. */
  clickGain: ((e: TickEvent) => number) | null = null;
  /** Relevé de diagnostic (mode débogage seulement) : heure du clic et heure de sa planification. */
  debugLog: { time: number; scheduledAt: number; sub: number }[] | null = null;

  constructor(private engine: AudioEngine) {
    this.scheduler = new MetronomeScheduler({ now: () => engine.ctx.currentTime });
    this.voice = new MetronomeVoice(engine.ctx, engine.metroBus);
    this.scheduler.onTick((e) => {
      if (this.debugLog) {
        this.debugLog.push({ time: e.time, scheduledAt: engine.ctx.currentTime, sub: e.sub });
        if (this.debugLog.length > 4000) this.debugLog.shift();
      }
      const gain = this.clickGain ? this.clickGain(e) : 1;
      this.voice.play(e, gain);
      if (e.audible && gain > 0) this.onClickAtMic?.(e.time + engine.outputLatency + engine.inputLatency);
      this.queue.push(e);
      // Page en arrière-plan : l'animation ne tourne plus ; on ne garde que les derniers événements.
      if (this.queue.length > 256) this.queue.splice(0, this.queue.length - 256);
    });
  }

  static signatureOf(id: string): TimeSignature {
    if (id.startsWith('custom:')) return customSignature(Number(id.slice(7)));
    return signatureById(id) ?? signatureById('4/4')!;
  }

  apply(s: Settings): void {
    const sig = MetronomeController.signatureOf(s.metro.signatureId);
    const states: BeatState[] = s.metro.beatStates.length === sig.beats ? s.metro.beatStates : defaultBeatStates(sig);
    this.scheduler.update({
      bpm: s.metro.bpm,
      signature: sig,
      beatStates: states,
      subdivision: s.metro.subdivision,
      countInBars: s.metro.countIn,
      accelerator: s.metro.accel,
      silent: s.metro.silent,
    });
    this.voice.sound = s.metro.sound;
    this.voice.volumes = s.metro.volumes;
    this.latencyMs = s.latencyMs;
    this.vibrate = s.vibrate;
  }

  get groupStarts(): Set<number> {
    return groupStarts(this.scheduler.config.signature);
  }

  onVisual(fn: (e: TickEvent) => void): void {
    this.visualListeners.push(fn);
  }

  onState(fn: (running: boolean) => void): void {
    this.stateListeners.push(fn);
  }

  get running(): boolean {
    return this.scheduler.isRunning;
  }

  async start(): Promise<void> {
    await this.engine.resume();
    this.queue = [];
    this.scheduler.start();
    this.ticker = startTicker(() => this.scheduler.tick(), 25);
    const loop = () => {
      this.drawFrame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.stateListeners.forEach((l) => l(true));
  }

  stop(): void {
    this.scheduler.stop();
    this.ticker?.stop();
    this.ticker = null;
    cancelAnimationFrame(this.raf);
    this.queue = [];
    this.lastShown = null;
    this.stateListeners.forEach((l) => l(false));
  }

  toggle(): void {
    if (this.running) this.stop();
    else void this.start();
  }

  /** Affiche les événements dont l'heure (+ latence de sortie + décalage utilisateur) est atteinte. */
  private drawFrame(): void {
    const now = this.engine.ctx.currentTime;
    const delay = this.engine.outputLatency + this.latencyMs / 1000;
    let last: TickEvent | null = null;
    while (this.queue.length && this.queue[0]!.time + delay <= now) last = this.queue.shift()!;
    if (!last) return;
    this.lastShown = last;
    if (this.vibrate && last.sub === 0 && last.beat === 0 && last.audible && 'vibrate' in navigator) navigator.vibrate(40);
    this.visualListeners.forEach((l) => l(last));
  }
}
