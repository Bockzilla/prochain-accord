import type { TickEvent } from '../metronome/scheduler';
import { chordPitchClasses, QUALITY_INTERVALS, type Chord } from '../theory/chords';
import type { Style } from '../theory/harmony';
import { mod12 } from '../theory/notes';
import { hitsForBeat, STYLE_DEFS, type BassDegree, type Part } from './patterns';

/**
 * Arrangeur — PUR. Reçoit les temps du métronome (même horloge) et calcule
 * les notes de l'accompagnement à leur heure exacte.
 */
export interface NoteEvent {
  time: number;
  part: Part;
  vel: number;
  /** Durée (s). */
  dur: number;
  /** Notes MIDI (basse : 1 note ; accord : plusieurs). */
  midi: number[];
  /** Décalage entre cordes (s) pour un grattage. */
  strum: number;
}

export interface ArrangeContext {
  style: Style;
  /** Une entrée par mesure, jouée en boucle. */
  loop: Chord[];
  /** Mesure de la boucle à laquelle reprendre (pause → lecture). */
  barOffset: number;
}

/** Accord de la boucle pour une mesure du métronome (null pendant le décompte). */
export function chordForBar(ctx: ArrangeContext, bar: number): { chord: Chord; index: number } | null {
  if (bar < 0 || ctx.loop.length === 0) return null;
  const index = (((bar + ctx.barOffset) % ctx.loop.length) + ctx.loop.length) % ctx.loop.length;
  return { chord: ctx.loop[index]!, index };
}

const BASS_LOW = 40; // Mi1… : la basse reste dans l'octave E2–D♯3 (MIDI 40–51)

export function bassMidi(c: Chord, d: BassDegree): number {
  const root = BASS_LOW + mod12(c.root - BASS_LOW);
  const third = QUALITY_INTERVALS[c.quality][1] ?? 4;
  const off: Record<BassDegree, number> = { '1': 0, '3': third, '5': 7, '6': 9, b7: 10, '8': 12 };
  return root + off[d];
}

/** Accord en position serrée au-dessus de Sol3 (MIDI 55), ou « power chord » (1-5-8). */
export function chordVoicing(c: Chord, power: boolean): number[] {
  if (power) {
    const root = 45 + mod12(c.root - 45); // La2…Sol♯3
    return [root, root + 7, root + 12];
  }
  return chordPitchClasses(c)
    .map((pc) => 55 + mod12(pc - 55))
    .sort((a, b) => a - b);
}

export function arrangeBeat(beat: TickEvent, ctx: ArrangeContext): NoteEvent[] {
  if (beat.sub !== 0 || beat.countIn || beat.late) return [];
  const cur = chordForBar(ctx, beat.bar);
  if (!cur) return [];
  const def = STYLE_DEFS[ctx.style];
  const period = 60 / beat.bpm;
  const lastBarOfLoop = cur.index === ctx.loop.length - 1;
  return hitsForBeat(ctx.style, beat.beat, beat.beatsPerBar, lastBarOfLoop).map((hit) => {
    // Swing : la 2e croche est retardée (croches ternaires en blues).
    const frac = hit.at === 0.5 ? def.swing : hit.at;
    const midi = hit.part === 'bass' ? [bassMidi(cur.chord, hit.bass ?? '1')] : hit.part === 'chord' ? chordVoicing(cur.chord, def.power) : [];
    return { time: beat.time + frac * period, part: hit.part, vel: hit.vel, dur: hit.len * period, midi, strum: hit.part === 'chord' ? def.strum : 0 };
  });
}
