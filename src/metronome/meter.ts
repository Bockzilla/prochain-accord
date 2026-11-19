/** Signatures rythmiques et états des temps — module PUR. */

export interface TimeSignature {
  id: string;
  beats: number;
  unit: 4 | 8;
  /** Regroupement des temps (6/8 = 3+3). La somme = beats. */
  groups: number[];
}

export const SIGNATURES: TimeSignature[] = [
  { id: '2/4', beats: 2, unit: 4, groups: [2] },
  { id: '3/4', beats: 3, unit: 4, groups: [3] },
  { id: '4/4', beats: 4, unit: 4, groups: [4] },
  { id: '5/4', beats: 5, unit: 4, groups: [3, 2] },
  { id: '6/8', beats: 6, unit: 8, groups: [3, 3] },
  { id: '7/8', beats: 7, unit: 8, groups: [2, 2, 3] },
  { id: '12/8', beats: 12, unit: 8, groups: [3, 3, 3, 3] },
];

export function signatureById(id: string): TimeSignature | undefined {
  return SIGNATURES.find((s) => s.id === id);
}

export function customSignature(beats: number): TimeSignature {
  const b = Math.max(1, Math.min(16, Math.round(beats)));
  return { id: `custom:${b}`, beats: b, unit: 4, groups: [b] };
}

/** Indices (0-based) des temps qui commencent un groupe. */
export function groupStarts(sig: TimeSignature): Set<number> {
  const out = new Set<number>();
  let i = 0;
  for (const g of sig.groups) {
    out.add(i);
    i += g;
  }
  return out;
}

export type BeatState = 'accent' | 'normal' | 'mute';

export function defaultBeatStates(sig: TimeSignature): BeatState[] {
  return Array.from({ length: sig.beats }, (_, i) => (i === 0 ? 'accent' : 'normal'));
}

/** Toucher un cercle : accentué → normal → muet → accentué. */
export function cycleBeatState(s: BeatState): BeatState {
  return s === 'accent' ? 'normal' : s === 'normal' ? 'mute' : 'accent';
}

export type Subdivision = 1 | 2 | 3 | 4; // noires, croches, triolets, doubles croches

export const MIN_BPM = 20;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
}
