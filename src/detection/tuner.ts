import { freqToMidi, midiToFreq } from '../theory/notes';
import { yinPitch, type PitchResult } from './pitch';

/**
 * Filtre en peigne y[n] = x[n] − x[n − T] : annule la note de période T et toutes ses harmoniques,
 * mais garde périodique (même période) toute autre note. Retard fractionnaire par interpolation linéaire.
 */
export function combRemove(x: Float32Array | Float64Array, sampleRate: number, freq: number): Float64Array | null {
  const T = sampleRate / freq;
  const k = Math.floor(T);
  const frac = T - k;
  if (k + 2 >= x.length / 2) return null;
  const y = new Float64Array(x.length - k - 1);
  for (let i = 0; i < y.length; i++) {
    const n = i + k + 1;
    y[i] = x[n]! - ((1 - frac) * x[n - k]! + frac * x[n - k - 1]!);
  }
  return y;
}

/**
 * Hauteur pour l'accordeur. Sur une guitare, la corde qu'on vient d'accorder sonne encore quand on pince
 * la suivante : le mélange des deux fait chuter la clarté et la nouvelle note serait rejetée (l'accordeur
 * restait « bloqué » sur l'ancienne). Pire : deux cordes voisines (une quarte, rapport 4/3) se répètent
 * ensemble avec une période commune plus longue, une « note fantôme » grave (Si3 + Mi4 = période de Mi2).
 *
 * Donc, si la mesure directe est floue ou ressemble à une fondamentale fantôme d'une note récente,
 * on retire les notes récentes (filtre en peigne : chacune seule, puis toutes) et on remesure le reste.
 * - Une note nouvelle, ou la note en cours (`ringing[0]`), est acceptée.
 * - Une note plus ancienne n'est acceptée que si son niveau a remonté (corde repincée) : sinon c'est
 *   seulement la corde précédente qui finit de sonner, et elle ne doit pas reprendre l'affichage.
 * Parmi les candidats, on garde le plus fort. `rms` du résultat = niveau estimé de cette seule note.
 */
export interface RingingNote {
  freq: number;
  /** Niveau attendu maintenant : son dernier niveau mesuré, diminué de l'extinction naturelle d'une corde. */
  level: number;
}

const centsApart = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));

/** f est-elle une fondamentale fantôme de r (r ≈ n·f avec n ≥ 2) ? */
function isSubharmonicOf(f: number, r: number): boolean {
  const n = Math.round(r / f);
  return n >= 2 && centsApart(r, n * f) < 20;
}

/** Ressemblance du signal avec lui-même décalé d'une période de f : 1 = parfaitement périodique. */
function periodicity(y: Float32Array | Float64Array, sampleRate: number, f: number): number {
  const T = sampleRate / f;
  const k = Math.floor(T);
  const frac = T - k;
  let xy = 0;
  let xx = 0;
  let yy = 0;
  for (let n = k + 1; n < y.length; n++) {
    const a = y[n]!;
    const b = (1 - frac) * y[n - k]! + frac * y[n - k - 1]!;
    xy += a * b;
    xx += a * a;
    yy += b * b;
  }
  return xx + yy > 0 ? (2 * xy) / (xx + yy) : 0;
}

/** Mesure la note nette qui reste après avoir retiré `removed` (null si rien de net). */
function residualNote(
  frame: Float32Array | Float64Array,
  sampleRate: number,
  removed: readonly RingingNote[],
  minClarity: number,
): PitchResult | null {
  let y: Float32Array | Float64Array | null = frame;
  for (const n of removed) y = y && combRemove(y, sampleRate, n.freq);
  if (!y) return null;
  const p = yinPitch(y, sampleRate);
  if (!p || p.clarity < minClarity) return null;
  // Dans un mélange, YIN peut tomber une ou deux octaves trop bas (Mi4 + un reste de Mi2 se répètent
  // comme un Mi2) : si le reste est presque aussi périodique à l'octave du dessus, c'est elle.
  // (Une vraie note grave a des harmoniques impaires : elle n'est pas périodique à la demi-période.)
  let f = p.freq;
  for (let k = 0; k < 2 && 2 * f <= DEFAULT_TUNER_FMAX; k++) {
    if (periodicity(y, sampleRate, 2 * f) < 0.9) break;
    f *= 2;
  }
  if (removed.some((n) => centsApart(f, n.freq) < 50 || isSubharmonicOf(f, n.freq))) return null;
  // Le peigne amplifie ou atténue selon la fréquence (gain 2·|sin(π·f/f₀)|) : on compense (approximatif).
  const gain = removed.reduce((g, n) => g * Math.max(0.5, 2 * Math.abs(Math.sin((Math.PI * f) / n.freq))), 1);
  return { freq: f, clarity: p.clarity, rms: p.rms / gain };
}

export function tunerPitch(
  frame: Float32Array | Float64Array,
  sampleRate: number,
  ringing: readonly RingingNote[],
  minClarity = DEFAULT_TUNER.minClarity,
): PitchResult | null {
  const direct = yinPitch(frame, sampleRate);
  if (!direct || ringing.length === 0 || direct.rms < DEFAULT_TUNER.minRms) return direct;
  const phantom = ringing.some((n) => isSubharmonicOf(direct.freq, n.freq));
  if (direct.clarity >= minClarity && !phantom) return direct;
  // Bruit sans aucune périodicité : inutile de chercher plus loin (économie de batterie).
  if (direct.clarity < 0.3) return direct;
  const current = ringing[0]!;
  const known = (f: number) => ringing.findIndex((n) => centsApart(n.freq, f) < 50);

  // 1. On retire la note en cours : s'il reste une note nette et forte, c'est soit une corde nouvelle,
  //    soit une ancienne corde nettement repincée (son niveau a au moins doublé).
  const r1 = residualNote(frame, sampleRate, [current], minClarity);
  if (r1 && r1.rms >= 0.3 * direct.rms) {
    const i = known(r1.freq);
    if (i < 0 || r1.rms >= 1.6 * ringing[i]!.level) return r1;
  }
  if (ringing.length > 1) {
    // 2. On retire toutes les notes récentes : s'il reste une note nette, nouvelle et forte, c'est la corde pincée.
    const r2 = residualNote(frame, sampleRate, ringing, Math.max(minClarity, 0.9));
    if (r2 && known(r2.freq) < 0 && r2.rms >= 0.3 * direct.rms) return r2;
    // 3. On retire les anciennes notes seulement : si la note en cours domine encore, on la garde.
    const r3 = residualNote(frame, sampleRate, ringing.slice(1), minClarity);
    if (r3 && known(r3.freq) === 0) return r3;
  }
  // Fantôme ou mélange sans réponse fiable : on n'affiche rien plutôt qu'une fausse note.
  return phantom ? null : direct;
}

const DEFAULT_TUNER_FMAX = 1400;

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
  private jumpCandidate: number | null = null;
  /** Dernières notes stables distinctes (la plus récente d'abord) : elles peuvent encore sonner. */
  private history: (RingingNote & { at: number })[] = [];
  private updates = 0;
  /** Mesures stables d'affilée : une note n'entre dans l'historique qu'après s'être confirmée. */
  private stableRun = 0;

  constructor(
    public mode: TunerMode = 'guitar',
    public a4 = 440,
    private opts: TunerOptions = DEFAULT_TUNER,
  ) {}

  /** Notes récentes susceptibles de sonner encore (pour `tunerPitch`). */
  get ringing(): readonly RingingNote[] {
    // Une corde laissée libre perd environ 1,5 % de niveau par mesure (≈ 45 ms), soit −6 dB en 2 s.
    // Les cordes éteintes depuis longtemps sont oubliées (la note en cours est toujours gardée).
    return this.history
      .map((n) => ({ freq: n.freq, level: n.level * 0.985 ** (this.updates - n.at) }))
      .filter((n, i) => i === 0 || n.level >= this.opts.minRms);
  }

  reset(): void {
    this.recent = [];
    this.smoothCents = null;
    this.jumpCandidate = null;
    this.history = [];
    this.stableRun = 0;
  }

  update(p: PitchResult | null): TunerReading | null {
    this.updates++;
    if (!p || p.clarity < this.opts.minClarity || p.rms < this.opts.minRms || !Number.isFinite(p.freq)) {
      this.recent = this.recent.slice(1); // le signal s'éteint : on oublie progressivement
      if (this.recent.length === 0) this.smoothCents = null;
      this.jumpCandidate = null;
      this.stableRun = 0;
      return null;
    }
    // Changement de note : deux mesures concordantes, loin de la médiane actuelle → on repart de zéro
    // au lieu d'attendre que les anciennes mesures sortent de la fenêtre.
    if (this.recent.length > 0) {
      const cur = [...this.recent].sort((a, b) => a - b)[Math.floor(this.recent.length / 2)]!;
      if (Math.abs(1200 * Math.log2(p.freq / cur)) > 50) {
        const prev = this.jumpCandidate;
        this.jumpCandidate = p.freq;
        this.stableRun = 0;
        if (prev === null || Math.abs(1200 * Math.log2(p.freq / prev)) > 50) return null;
        this.recent = [prev];
        this.smoothCents = null;
      }
    }
    this.jumpCandidate = null;
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
    this.stableRun = stable ? this.stableRun + 1 : 0;
    if (this.stableRun >= 4) {
      const note = { freq: median, level: p.rms, at: this.updates };
      if (this.history.length > 0 && centsApart(median, this.history[0]!.freq) < 50) this.history[0] = note;
      else this.history = [note, ...this.history.filter((n) => centsApart(median, n.freq) >= 50)].slice(0, 3);
    }
    return { freq: median, target, cents: this.smoothCents, string, stable, inTune: stable && Math.abs(this.smoothCents) <= 5 };
  }
}
