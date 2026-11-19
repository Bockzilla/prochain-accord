/**
 * Mouvements de la mascotte — calculs PURS (aucune horloge, aucun audio).
 * L'interface fournit la phase dans le temps en cours, lue sur l'horloge audio :
 * l'animation SUIT la musique, elle ne la pilote jamais.
 *
 * Choix musical : l'impact (réception + écrasement) tombe EXACTEMENT sur le temps,
 * l'envol se fait pendant la 2e moitié du temps précédent (comme un pied qui bat la mesure).
 */
export interface MotionStyle {
  hop: number;
  squash: number;
  sway: number;
}

export interface Pose {
  /** Décalage vertical (négatif = en l'air). */
  y: number;
  sx: number;
  sy: number;
  /** Rotation (degrés). */
  rot: number;
  /** Angle des bras (degrés). */
  arms: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * @param phase position dans le temps courant (0 = sur le temps, 1 = temps suivant)
 * @param nextIsAccent le temps suivant est le temps 1 (saut plus haut)
 * @param beatIndex numéro du temps courant (pour le balancement alterné)
 */
export function hopPose(phase: number, nextIsAccent: boolean, beatIndex: number, m: MotionStyle): Pose {
  const p = clamp01(phase);
  let y = 0;
  let sx = 1;
  let sy = 1;
  // Réception : écrasement maximal sur le temps, qui se relâche en 15 % du temps.
  if (p < 0.15) {
    const k = 1 - p / 0.15;
    sy = 1 - m.squash * k;
    sx = 1 + m.squash * 0.8 * k;
  }
  // Envol pendant la 2e moitié : parabole qui retombe pile au temps suivant.
  if (p >= 0.5) {
    const q = (p - 0.5) / 0.5;
    const h = m.hop * (nextIsAccent ? 1.4 : 1);
    y = -h * 4 * q * (1 - q);
    sy = 1 + 0.06 * Math.sin(Math.PI * q);
    sx = 1 - 0.04 * Math.sin(Math.PI * q);
  }
  const side = beatIndex % 2 === 0 ? 1 : -1;
  const rot = m.sway * side * Math.sin(Math.PI * p);
  const arms = p >= 0.5 ? -35 * Math.sin(Math.PI * ((p - 0.5) / 0.5)) : 0;
  return { y, sx, sy, rot, arms };
}

/** Saut d'un îlot à un autre : parabole de (x0, y0) à (x1, y1), t de 0 à 1. */
export function jumpPoint(t: number, x0: number, y0: number, x1: number, y1: number, height: number): { x: number; y: number } {
  const q = clamp01(t);
  const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2; // accélère puis freine
  return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e - height * 4 * q * (1 - q) };
}

/** Respiration au repos (pas de métronome) : très léger, période en secondes. */
export function idlePose(tSec: number, period = 2.4): Pose {
  const k = Math.sin((2 * Math.PI * tSec) / period);
  return { y: 0, sx: 1 + 0.015 * k, sy: 1 - 0.02 * k, rot: 0, arms: 4 * k };
}

/** Célébration : petit tour sur soi avec saut, t de 0 à 1. */
export function celebratePose(t: number, m: MotionStyle): Pose {
  const q = clamp01(t);
  return { y: -m.hop * 1.6 * 4 * q * (1 - q), sx: 1, sy: 1, rot: 360 * q, arms: -60 * Math.sin(Math.PI * q) };
}
