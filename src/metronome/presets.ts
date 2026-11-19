import { customSignature, signatureById, type BeatState, type Subdivision, type TimeSignature } from './meter';

export type SoundId = 'click' | 'wood' | 'hihat' | 'beep';

export interface Preset {
  name: string;
  bpm: number;
  signatureId: string;
  beatStates: BeatState[];
  subdivision: Subdivision;
  sound: SoundId;
}

export const DEFAULT_PRESETS: Preset[] = [
  { name: 'Ballade 72 — 6/8', bpm: 72, signatureId: '6/8', beatStates: ['accent', 'normal', 'normal', 'normal', 'normal', 'normal'], subdivision: 1, sound: 'wood' },
  { name: 'Rock 120 — 4/4', bpm: 120, signatureId: '4/4', beatStates: ['accent', 'normal', 'normal', 'normal'], subdivision: 2, sound: 'hihat' },
];

export function resolveSignature(id: string): TimeSignature {
  if (id.startsWith('custom:')) return customSignature(Number(id.slice(7)));
  return signatureById(id) ?? signatureById('4/4')!;
}

/** Stockage minimal (localStorage ou faux stockage en test). */
export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = 'pa.presets.v1';

function isPreset(x: unknown): x is Preset {
  const p = x as Preset;
  return !!p && typeof p.name === 'string' && typeof p.bpm === 'number' && typeof p.signatureId === 'string' && Array.isArray(p.beatStates);
}

export function loadPresets(store: KeyValueStore | null): Preset[] {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return [...DEFAULT_PRESETS];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPreset).slice(0, 50) : [...DEFAULT_PRESETS];
  } catch {
    return [...DEFAULT_PRESETS];
  }
}

export function savePresets(store: KeyValueStore | null, presets: Preset[]): void {
  try {
    store?.setItem(KEY, JSON.stringify(presets.slice(0, 50)));
  } catch {
    /* stockage indisponible (navigation privée…) : on ignore */
  }
}
