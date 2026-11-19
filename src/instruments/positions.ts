import guitarTable from '../data/chord-shapes.guitar.json';
import mandolinTable from '../data/chord-shapes.mandolin.json';
import { chordId, type Chord, type ChordQuality } from '../theory/chords';
import { mod12 } from '../theory/notes';
import { assignFingers } from './fingers';
import { generatePositions } from './fingering-generator';
import type { Fingering, Fret, FrettedInstrument, ShapeLabel } from './model';
import { validateFingering } from './validate';

interface TableEntry {
  root: number;
  quality: string;
  frets: string;
}

export function parseFrets(s: string): Fret[] {
  return [...s].map((ch) => (ch === 'x' || ch === 'X' ? null : Number(ch)));
}

function tableFor(inst: FrettedInstrument): TableEntry[] {
  return (inst.id === 'guitar' ? guitarTable.shapes : mandolinTable.shapes) as TableEntry[];
}

/** Formes mobiles de barré (décalages relatifs à la case du barré, null = muette). */
const E_SHAPES: Partial<Record<ChordQuality, Fret[]>> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  maj7: [0, null, 1, 1, 0, null],
  m7: [0, 2, 0, 0, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
};
const A_SHAPES: Partial<Record<ChordQuality, Fret[]>> = {
  maj: [null, 0, 2, 2, 2, 0],
  min: [null, 0, 2, 2, 1, 0],
  '7': [null, 0, 2, 0, 2, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  sus4: [null, 0, 2, 2, 3, 0],
};

function barreShape(inst: FrettedInstrument, c: Chord, shape: Fret[] | undefined, stringIdx: number): Fret[] | null {
  if (!shape) return null;
  let b = mod12(c.root - inst.tuning[stringIdx]!);
  if (b === 0) b = 12; // la forme « à vide » est déjà couverte par la table
  return shape.map((o) => (o === null ? null : o + b));
}

export function baseFretFor(frets: Fret[]): number {
  const pressed = frets.filter((f): f is number => f !== null && f > 0);
  if (pressed.length === 0) return 1;
  return Math.max(...pressed) <= 4 ? 1 : Math.min(...pressed);
}

export function toFingering(frets: Fret[], label: ShapeLabel): Fingering | null {
  const fa = assignFingers(frets);
  if (!fa) return null;
  return { frets, fingers: fa.fingers, barre: fa.barre, baseFret: baseFretFor(frets), label };
}

const cache = new Map<string, Fingering[]>();

/**
 * Toutes les positions d'un accord, de la plus basse à la plus haute sur le manche :
 * table de référence (ouvert) → barré forme E → barré forme A → générateur (plus haut).
 * Chaque position est validée (notes exactes + jouabilité) avant d'être retournée.
 */
export function chordPositions(inst: FrettedInstrument, c: Chord, max = 5): Fingering[] {
  const cacheKey = `${inst.id}|${chordId(c)}|${max}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const list: { frets: Fret[]; label: ShapeLabel; fromTable?: boolean }[] = [];
  const isTable = (x: { fromTable?: boolean }) => !!x.fromTable;
  for (const e of tableFor(inst)) {
    if (mod12(e.root) === mod12(c.root) && e.quality === c.quality) list.push({ frets: parseFrets(e.frets), label: 'open', fromTable: true });
  }
  if (inst.id === 'guitar') {
    const e = barreShape(inst, c, E_SHAPES[c.quality], 0);
    if (e) list.push({ frets: e, label: 'eShape' });
    const a = barreShape(inst, c, A_SHAPES[c.quality], 1);
    if (a) list.push({ frets: a, label: 'aShape' });
  }
  for (const g of generatePositions(inst, c)) {
    const pressed = g.filter((f): f is number => f !== null && f > 0);
    const label: ShapeLabel = pressed.length === 0 || Math.max(...pressed) <= 4 ? 'open' : 'upNeck';
    list.push({ frets: g, label });
  }

  const lowest = (frets: Fret[]) => {
    const p = frets.filter((x): x is number => x !== null && x > 0);
    return p.length ? Math.min(...p) : 0;
  };
  const seen = new Set<string>();
  const result: Fingering[] = [];
  for (const item of list) {
    if (result.length >= max) break;
    const k = item.frets.join(',');
    if (seen.has(k)) continue;
    if (!validateFingering(inst, c, item.frets).ok) continue;
    // Variété : une position générée doit être à au moins 2 cases des positions déjà retenues.
    if (item.label === 'upNeck' || (item.label === 'open' && result.length > 0 && !isTable(item))) {
      if (result.length >= 2 && result.some((r) => Math.abs(lowest(r.frets) - lowest(item.frets)) < 2)) continue;
    }
    const f = toFingering(item.frets, item.label);
    if (!f) continue;
    seen.add(k);
    result.push(f);
  }
  result.sort((a, b) => lowest(a.frets) - lowest(b.frets));
  cache.set(cacheKey, result);
  return result;
}
