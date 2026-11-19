import type { Chord } from '../theory/chords';
import type { Key } from '../theory/keys';
import type { Settings } from './settings';

/**
 * État musical partagé entre les 4 espaces : tonalité (choisie ou détectée),
 * accords joués. Le tempo est partagé par le métronome lui-même.
 */
export class SharedMusic {
  detectedKey: Key | null = null;
  detectedConfidence = 0;
  played: Chord[] = [];
  private listeners = new Set<() => void>();

  constructor(private settings: Settings) {}

  /** Tonalité de travail : manuelle, sinon détectée, sinon la dernière choisie. */
  get key(): Key {
    const m = this.settings.music;
    if (m.keyMode === 'auto' && this.detectedKey) return this.detectedKey;
    return { tonic: m.tonic, mode: m.mode };
  }

  get source(): 'manual' | 'detected' | 'default' {
    if (this.settings.music.keyMode === 'manual') return 'manual';
    return this.detectedKey ? 'detected' : 'default';
  }

  setManualKey(k: Key): void {
    Object.assign(this.settings.music, { keyMode: 'manual', tonic: k.tonic, mode: k.mode });
    this.emit();
  }

  useDetected(): void {
    this.settings.music.keyMode = 'auto';
    this.emit();
  }

  /** Appelé par l'espace Jouer à chaque nouvel accord validé. */
  setDetected(key: Key | null, confidence: number, played: Chord[]): void {
    this.detectedKey = key;
    this.detectedConfidence = confidence;
    this.played = [...played];
    this.emit();
  }

  on(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const l of this.listeners) l();
  }
}
