import type { NeckNote } from '../theory/fretboard';
import { s } from './dom';

export interface NeckOptions {
  tuning: readonly number[];
  frets: number;
  notes: NeckNote[];
  /** Notes de la position active (les autres sont atténuées) ; null = tout le manche. */
  focus: Set<string> | null;
  label: (n: NeckNote) => string;
  lefty: boolean;
  title: string;
  onNote: (n: NeckNote) => void;
}

export const noteKey = (n: { string: number; fret: number }) => `${n.string}:${n.fret}`;

const INLAYS = [3, 5, 7, 9, 15, 17];

/**
 * Manche horizontal : corde de Mi aigu en haut (comme une tablature), cases 0 à N.
 * Fondamentale = carré arrondi orange (forme ET couleur), autres notes = ronds.
 * Chaque note est un bouton accessible : la toucher la fait entendre.
 */
export function renderNeck(o: NeckOptions): SVGElement {
  const S = o.tuning.length;
  const fretW = 40;
  const openW = 34;
  const gap = 26;
  const top = 18;
  const W = openW + fretW * o.frets + 10;
  const H = top + gap * (S - 1) + 34;
  const xOf = (f: number) => {
    const x = f === 0 ? openW / 2 : openW + fretW * (f - 0.5);
    return o.lefty ? W - x : x;
  };
  const yOf = (str: number) => top + gap * (S - 1 - str);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'neck', role: 'group', 'aria-label': o.title, width: W, height: H });

  // Repères (incrustations)
  for (const f of INLAYS) if (f <= o.frets) svg.append(s('circle', { cx: xOf(f), cy: top + (gap * (S - 1)) / 2, r: 5, class: 'inlay' }));
  if (o.frets >= 12) {
    svg.append(s('circle', { cx: xOf(12), cy: top + gap * 1.5, r: 5, class: 'inlay' }), s('circle', { cx: xOf(12), cy: top + gap * 3.5, r: 5, class: 'inlay' }));
  }
  // Sillet et frettes
  const nutX = o.lefty ? W - openW : openW;
  svg.append(s('rect', { x: nutX - 2, y: top - 4, width: 4, height: gap * (S - 1) + 8, class: 'nut' }));
  for (let f = 1; f <= o.frets; f++) {
    const x = o.lefty ? W - (openW + fretW * f) : openW + fretW * f;
    svg.append(s('line', { x1: x, x2: x, y1: top - 4, y2: top + gap * (S - 1) + 4, class: 'fret' }));
    svg.append(s('text', { x: xOf(f), y: H - 6, 'text-anchor': 'middle', class: 'fretnum', text: String(f) }));
  }
  for (let st = 0; st < S; st++) {
    const x1 = o.lefty ? 0 : openW;
    const x2 = o.lefty ? W - openW : W;
    svg.append(s('line', { x1, x2, y1: yOf(st), y2: yOf(st), class: 'nstring', 'stroke-width': 1 + (S - 1 - st) * 0.25 }));
  }

  // Notes
  for (const n of o.notes) {
    if (n.fret > o.frets) continue;
    const dim = o.focus !== null && !o.focus.has(noteKey(n));
    const cx = xOf(n.fret);
    const cy = yOf(n.string);
    const g = s('g', {
      class: `nnote${n.isRoot ? ' root' : ''}${dim ? ' dim' : ''}`,
      role: 'button',
      tabindex: dim ? -1 : 0,
      'aria-label': o.label(n),
    });
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
  }
  return svg;
}
