/**
 * Profils de réactivité de la reconnaissance d'accords — mesurés, pas supposés
 * (voir tests/profiles.test.ts et docs/ROADMAP-MUSIC-ADVENTURE.md).
 */
export type ProfileId = 'fast' | 'balanced' | 'stable';
export const PROFILE_IDS: ProfileId[] = ['fast', 'balanced', 'stable'];

export interface DetectionProfile {
  id: ProfileId;
  /** Taille de la fenêtre d'analyse (échantillons). */
  frameSize: number;
  /** Durée de stabilité exigée avant d'afficher un accord (ms). */
  holdMs: number;
  /** Confiance minimale. */
  minConfidence: number;
  /** Marge du seuil de bruit adaptatif (× bruit de fond). */
  noiseMargin: number;
  /** Intervalle entre deux analyses (ms). */
  intervalMs: number;
  /** Trame ratée tolérée sans perdre l'accord en attente (ms). */
  gapToleranceMs: number;
}

export const PROFILES: Record<ProfileId, DetectionProfile> = {
  // Signal propre (interface audio, pièce calme) : réagit vite.
  fast: { id: 'fast', frameSize: 4096, holdMs: 160, minConfidence: 0.4, noiseMargin: 2, intervalMs: 35, gapToleranceMs: 0 },
  // Compromis par défaut.
  balanced: { id: 'balanced', frameSize: 8192, holdMs: 350, minConfidence: 0.45, noiseMargin: 2.5, intervalMs: 50, gapToleranceMs: 120 },
  // Pièce bruyante, micro du téléphone : plus lent, mais ne « saute » pas.
  stable: { id: 'stable', frameSize: 8192, holdMs: 600, minConfidence: 0.5, noiseMargin: 2.5, intervalMs: 60, gapToleranceMs: 250 },
};
