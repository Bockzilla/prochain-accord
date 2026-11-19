import type { Fingering, FrettedInstrument } from '../instruments/model';
import { s } from './dom';

export interface FretboardOptions {
  lefty: boolean;
  compact: boolean;
  /** Étiquette accessible (nom de l'accord, position…). */
  label: string;
  /** Texte de la case de départ, ex. « 5 fr ». */
  baseFretLabel: (n: number) => string;
}

/**
 * Diagramme d'accord vertical (cordes verticales, cases horizontales).
 * X = corde non jouée, O = à vide, ronds numérotés = doigts, barre arrondie = barré.
 * Mandoline : une seule ligne par paire de cordes.
 */
export function renderFretboard(inst: FrettedInstrument, f: Fingering, o: FretboardOptions): SVGElement {
  const S = inst.tuning.length;
  const pressed = f.frets.filter((x): x is number => x !== null && x > 0);
  const maxF = pressed.length ? Math.max(...pressed) : 0;
  const rows = Math.max(4, maxF - f.baseFret + 1);
  const gap = 24;
  const fretH = 28;
  const left = 30;
  const top = 30;
  const W = left + gap * (S - 1) + 20;
  const H = top + fretH * rows + 12;
  const x = (i: number) => left + gap * (o.lefty ? S - 1 - i : i);
  const y = (fret: number) => top + fretH * (fret - f.baseFret + 0.5);

  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: `fretboard${o.compact ? ' compact' : ''}`,
    role: 'img',
    'aria-label': o.label,
  });
  // Sillet (épais) ou case de départ
  if (f.baseFret === 1) svg.append(s('rect', { x: left - 2, y: top - 5, width: gap * (S - 1) + 4, height: 5, class: 'nut' }));
  else svg.append(s('text', { x: left - 10, y: top + fretH * 0.5 + 5, class: 'basefret', 'text-anchor': 'end', text: o.baseFretLabel(f.baseFret) }));
  for (let r = 0; r <= rows; r++) svg.append(s('line', { x1: left, x2: left + gap * (S - 1), y1: top + fretH * r, y2: top + fretH * r, class: 'fret' }));
  for (let i = 0; i < S; i++) svg.append(s('line', { x1: x(i), x2: x(i), y1: top, y2: top + fretH * rows, class: inst.stringsPerCourse > 1 ? 'string course' : 'string' }));

  if (f.barre) {
    const xa = Math.min(x(f.barre.fromString), x(f.barre.toString));
    const xb = Math.max(x(f.barre.fromString), x(f.barre.toString));
    svg.append(s('rect', { x: xa - 9, y: y(f.barre.fret) - 9, width: xb - xa + 18, height: 18, rx: 9, class: 'barre' }));
  }
  f.frets.forEach((fr, i) => {
    if (fr === null) {
      svg.append(s('text', { x: x(i), y: top - 11, class: 'mute', 'text-anchor': 'middle', text: '×' }));
    } else if (fr === 0) {
      svg.append(s('circle', { cx: x(i), cy: top - 15, r: 5.5, class: 'open' }));
    } else {
      const onBarre = f.barre && f.barre.fret === fr && f.fingers[i] === 1;
      if (!onBarre) svg.append(s('circle', { cx: x(i), cy: y(fr), r: 9, class: 'dot' }));
      if (!o.compact && f.fingers[i]) {
        svg.append(s('text', { x: x(i), y: y(fr) + 4.5, class: 'finger', 'text-anchor': 'middle', text: String(f.fingers[i]) }));
      }
    }
  });
  return svg;
}
