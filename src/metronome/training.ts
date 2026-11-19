/** Fonctions d'entraînement — PURES, testables sans audio. */

export interface AcceleratorConfig {
  enabled: boolean;
  /** +X BPM… */
  stepBpm: number;
  /** …toutes les N mesures… */
  everyBars: number;
  /** …jusqu'à ce tempo. */
  targetBpm: number;
}

export interface SilentBarsConfig {
  enabled: boolean;
  /** Le clic joue N mesures… */
  playBars: number;
  /** …puis se tait M mesures. */
  muteBars: number;
}

/** Tempo de la mesure `bar` (0 = première mesure après le décompte). */
export function acceleratedBpm(baseBpm: number, cfg: AcceleratorConfig, bar: number): number {
  if (!cfg.enabled || cfg.everyBars <= 0 || cfg.stepBpm === 0 || bar < 0) return baseBpm;
  const steps = Math.floor(bar / cfg.everyBars);
  const raw = baseBpm + steps * cfg.stepBpm;
  return cfg.stepBpm > 0 ? Math.min(raw, Math.max(baseBpm, cfg.targetBpm)) : Math.max(raw, Math.min(baseBpm, cfg.targetBpm));
}

/** La mesure `bar` (0 = première après le décompte) est-elle silencieuse ? */
export function isSilentBar(cfg: SilentBarsConfig, bar: number): boolean {
  if (!cfg.enabled || cfg.muteBars <= 0 || bar < 0) return false;
  const cycle = Math.max(1, cfg.playBars) + cfg.muteBars;
  return bar % cycle >= Math.max(1, cfg.playBars);
}
