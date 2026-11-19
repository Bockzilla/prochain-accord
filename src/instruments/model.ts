/**
 * Modèle commun : un instrument à cordes = liste de cordes accordées + nombre de cases.
 * Ajouter un ukulélé ou une basse = ajouter une entrée ici, sans rien réécrire.
 */
export type FrettedId = 'guitar' | 'mandolin';
export type InstrumentId = FrettedId | 'piano';

export interface FrettedInstrument {
  id: FrettedId;
  /** Hauteur MIDI des cordes à vide, de la plus grave à la plus aiguë. */
  tuning: number[];
  frets: number;
  /** Cordes par chœur (2 pour la mandoline) — affiché comme une seule ligne. */
  stringsPerCourse: number;
  /** Nombre minimal de cordes qui sonnent pour un doigté valable. */
  minSounding: number;
  /** Écart maximal (en cases) entre la case la plus basse et la plus haute appuyées. */
  maxSpan: number;
  /** Exiger la fondamentale à la basse pour les positions générées (si possible). */
  rootInBass: boolean;
}

export const GUITAR: FrettedInstrument = {
  id: 'guitar',
  tuning: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
  frets: 15,
  stringsPerCourse: 1,
  minSounding: 4,
  maxSpan: 4,
  rootInBass: true,
};

export const MANDOLIN: FrettedInstrument = {
  id: 'mandolin',
  tuning: [55, 62, 69, 76], // G3 D4 A4 E5
  frets: 15,
  stringsPerCourse: 2,
  minSounding: 4,
  maxSpan: 4,
  rootInBass: false,
};

export const FRETTED: Record<FrettedId, FrettedInstrument> = { guitar: GUITAR, mandolin: MANDOLIN };

/** null = corde non jouée (X), 0 = à vide (O), n = case. */
export type Fret = number | null;

export type ShapeLabel = 'open' | 'eShape' | 'aShape' | 'upNeck';

export interface Barre {
  fret: number;
  fromString: number;
  toString: number;
}

export interface Fingering {
  frets: Fret[];
  /** Numéro de doigt par corde (1 = index … 4 = auriculaire, 0 = aucun). */
  fingers: number[];
  barre: Barre | null;
  /** Première case affichée sur le diagramme. */
  baseFret: number;
  label: ShapeLabel;
}
