import { positionsOfMidi, type NeckNote, type NoteLevel } from '../theory/fretboard';
import { s } from './dom';

export interface PositionBand {
  index: number; // 1..5
  from: number;
  to: number;
  selected: boolean;
}

export interface NeckOptions {
  tuning: readonly number[];
  frets: number;
  notes: NeckNote[];
  levelOf: (n: NeckNote) => NoteLevel;
  label: (n: NeckNote) => string;
  lefty: boolean;
  title: string;
  onNote: (n: NeckNote) => void;
  bands: PositionBand[];
  /** Libellé accessible d'une position de la règle (« Position 2 »). */
  bandLabel: (i: number) => string;
}

export interface NeckHandle {
  svg: SVGElement;
  /** Met en évidence la note jouée (toutes ses positions possibles) ; null = aucune. */
  setPlayed(midi: number | null, label: string): void;
}

export const noteKey = (n: { string: number; fret: number }) => `${n.string}:${n.fret}`;

const INLAYS = [3, 5, 7, 9, 15, 17];
export const BAND_COLORS = ['#5cc8ff', '#4ade80', '#ffb340', '#c084fc', '#fb7185'];

/**
 * Manche horizontal : corde de Mi aigu en haut (comme une tablature).
 * Fondamentale = carré arrondi (forme ET couleur) ; règle des 5 positions au-dessus.
 */
export function renderNeck(o: NeckOptions): NeckHandle {
  const S = o.tuning.length;
  const fretW = 40;
  const openW = 34;
  const gap = 26;
  const ruler = 12 + o.bands.length * 7;
  const top = 18 + ruler;
  const W = openW + fretW * o.frets + 10;
  const H = top + gap * (S - 1) + 34;
  const xOf = (f: number) => {
    const x = f === 0 ? openW / 2 : openW + fretW * (f - 0.5);
    return o.lefty ? W - x : x;
  };
  const xEdge = (f: number) => (o.lefty ? W - (openW + fretW * f) : openW + fretW * f);
  const yOf = (str: number) => top + gap * (S - 1 - str);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'neck', role: 'group', 'aria-label': o.title, width: W, height: H });

  // Règle des 5 positions (une barre colorée et numérotée par position).
  o.bands.forEach((b, i) => {
    const xa = Math.min(xEdge(Math.max(0, b.from - 1)), xEdge(b.to));
    const xb = Math.max(xEdge(Math.max(0, b.from - 1)), xEdge(b.to));
    const y = 8 + i * 7;
    svg.append(
      s('g', { class: `band${b.selected ? ' sel' : ''}`, 'aria-label': o.bandLabel(b.index) }, [
        s('rect', { x: xa + 2, y, width: Math.max(8, xb - xa - 4), height: b.selected ? 6 : 4, rx: 2, fill: BAND_COLORS[(b.index - 1) % 5] }),
        s('text', { x: xa - 3, y: y + 5, 'text-anchor': 'end', class: 'band-num', fill: BAND_COLORS[(b.index - 1) % 5], text: String(b.index) }),
      ]),
    );
    if (b.selected) svg.append(s('rect', { x: xa, y: top - 8, width: xb - xa, height: gap * (S - 1) + 16, rx: 6, class: 'band-zone', stroke: BAND_COLORS[(b.index - 1) % 5] }));
  });

  for (const f of INLAYS) if (f <= o.frets) svg.append(s('circle', { cx: xOf(f), cy: top + (gap * (S - 1)) / 2, r: 5, class: 'inlay' }));
  if (o.frets >= 12) svg.append(s('circle', { cx: xOf(12), cy: top + gap * 1.5, r: 5, class: 'inlay' }), s('circle', { cx: xOf(12), cy: top + gap * 3.5, r: 5, class: 'inlay' }));
  const nutX = o.lefty ? W - openW : openW;
  svg.append(s('rect', { x: nutX - 2, y: top - 4, width: 4, height: gap * (S - 1) + 8, class: 'nut' }));
  for (let f = 1; f <= o.frets; f++) {
    svg.append(s('line', { x1: xEdge(f), x2: xEdge(f), y1: top - 4, y2: top + gap * (S - 1) + 4, class: 'fret' }));
    svg.append(s('text', { x: xOf(f), y: H - 6, 'text-anchor': 'middle', class: 'fretnum', text: String(f) }));
  }
  for (let st = 0; st < S; st++) {
    svg.append(s('line', { x1: o.lefty ? 0 : openW, x2: o.lefty ? W - openW : W, y1: yOf(st), y2: yOf(st), class: 'nstring', 'stroke-width': 1 + (S - 1 - st) * 0.25 }));
  }

  const byMidi = new Map<number, SVGElement[]>();
  // Ordre de dessin : le contexte d'abord, les niveaux importants par-dessus.
  const order: NoteLevel[] = ['context', 'neighbor', 'position', 'chordTone', 'played'];
  const sorted = o.notes.filter((n) => n.fret <= o.frets).map((n) => ({ n, lv: o.levelOf(n) }));
  sorted.sort((a, b) => order.indexOf(a.lv) - order.indexOf(b.lv));
  for (const { n, lv } of sorted) {
    const cx = xOf(n.fret);
    const cy = yOf(n.string);
    const g = s('g', { class: `nnote lv-${lv}${n.isRoot ? ' root' : ''}`, role: 'button', tabindex: lv === 'context' ? -1 : 0, 'aria-label': o.label(n), 'data-midi': n.midi });
    g.append(
      n.isRoot ? s('rect', { x: cx - 11, y: cy - 11, width: 22, height: 22, rx: 5 }) : s('circle', { cx, cy, r: 11 }),
      s('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', text: o.label(n) }),
    );
    const fire = () => o.onNote(n);
    g.addEventListener('click', fire);
    g.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        fire();
      }
    });
    svg.append(g);
    byMidi.set(n.midi, [...(byMidi.get(n.midi) ?? []), g]);
  }

  // Couche « note jouée » : anneaux sur toutes les positions possibles de la hauteur.
  const playedLayer = s('g', { class: 'played-layer', 'aria-hidden': 'true' });
  svg.append(playedLayer);
  let lastMidi: number | null = null;
  return {
    svg,
    setPlayed(midi, label) {
      if (midi === lastMidi) return;
      if (lastMidi !== null) for (const g of byMidi.get(lastMidi) ?? []) g.classList.remove('is-played');
      lastMidi = midi;
      playedLayer.replaceChildren();
      if (midi === null) return;
      for (const g of byMidi.get(midi) ?? []) g.classList.add('is-played');
      for (const p of positionsOfMidi(midi, o.tuning, o.frets)) {
        const cx = xOf(p.fret);
        const cy = yOf(p.string);
        playedLayer.append(s('circle', { cx, cy, r: 16, class: 'played-ring' }));
        if (!byMidi.has(midi)) playedLayer.append(s('circle', { cx, cy, r: 11, class: 'played-out' }), s('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'played-out-label', text: label }));
      }
    },
  };
}
