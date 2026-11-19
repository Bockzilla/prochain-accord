/**
 * Reconnaissance adaptative : estimation continue du bruit de fond de la pièce.
 *
 * On suit le niveau (RMS) des trames, en gardant un « plancher » qui descend vite
 * (quand la pièce devient calme) et remonte lentement (pour ne pas confondre une note
 * tenue avec du bruit). Le seuil effectif = max(seuil manuel, plancher × marge).
 */
export interface NoiseFloorOptions {
  /** Vitesse de remontée par seconde (facteur multiplicatif). */
  riseRate: number;
  /** Marge au-dessus du bruit pour ouvrir le gate. */
  margin: number;
  /** Plancher minimal absolu (micro très silencieux). */
  minimum: number;
  /** Plafond : au-delà, on considère que c'est de la musique, pas du bruit. */
  maximum: number;
}

export const DEFAULT_NOISE_FLOOR: NoiseFloorOptions = { riseRate: 1.5, margin: 2.5, minimum: 0.0005, maximum: 0.05 };

export class NoiseFloor {
  private floor: number | null = null;
  private lastT = 0;

  constructor(private opts: NoiseFloorOptions = DEFAULT_NOISE_FLOOR) {}

  /** Nouvelle mesure de niveau à l'instant tSec. */
  update(rms: number, tSec: number): void {
    if (!Number.isFinite(rms) || rms < 0) return;
    const level = Math.min(this.opts.maximum, Math.max(this.opts.minimum, rms));
    // Départ au plancher minimal : la première trame peut être de la musique, pas du bruit.
    if (this.floor === null) {
      this.floor = this.opts.minimum;
      this.lastT = tSec;
    }
    if (level < this.floor) {
      this.floor = level; // descente immédiate
    } else {
      const dt = Math.max(0, Math.min(1, tSec - this.lastT));
      this.floor = Math.min(level, this.floor * this.opts.riseRate ** dt); // remontée lente
    }
    this.lastT = tSec;
  }

  get value(): number {
    return this.floor ?? this.opts.minimum;
  }

  /** Seuil du gate : jamais sous le réglage manuel de sensibilité. */
  gate(manual: number): number {
    return Math.max(manual, this.value * this.opts.margin);
  }

  reset(): void {
    this.floor = null;
  }
}
