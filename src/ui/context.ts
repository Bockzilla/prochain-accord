import type { AudioEngine } from '../audio/engine';
import type { ChordDetector } from '../detection/detector';
import { getLocale } from '../i18n/i18n';
import { chordName, pcName } from '../i18n/notation';
import type { Chord } from '../theory/chords';
import type { Key } from '../theory/keys';
import type { Spelling } from '../theory/notes';
import type { MetronomeController } from './metronome-controller';
import type { Settings } from './settings';

/** Contexte partagé par les vues. */
export interface AppContext {
  settings: Settings;
  engine: AudioEngine;
  metro: MetronomeController;
  detector: ChordDetector;
  /** Sauvegarde les réglages et prévient les vues. */
  commit(opts?: { rerender?: boolean }): void;
}

export function nameOf(ctx: AppContext, c: Chord, key: Key | null = null, spelling?: Spelling): string {
  return chordName(c, ctx.settings.notation, getLocale(), key, spelling);
}

export function noteOf(ctx: AppContext, pc: number): string {
  return pcName(pc, ctx.settings.notation, getLocale());
}
