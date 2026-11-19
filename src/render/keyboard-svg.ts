import { PIANO_HIGH, PIANO_LOW, type PianoVoicing } from '../instruments/piano';
import { mod12 } from '../theory/notes';
import { s } from './dom';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // pc noir → index de la blanche à gauche

/**
 * Clavier de 2 octaves. Notes de l'accord en surbrillance ; la fondamentale a une couleur
 * distincte ET un marqueur en losange (la couleur n'est jamais la seule information).
 */
export function renderKeyboard(v: PianoVoicing, o: { compact: boolean; label: string; noteLabel: (pc: number) => string }): SVGElement {
  const ww = 22;
  const wh = o.compact ? 70 : 100;
  const bw = 14;
  const bh = wh * 0.62;
  const whites: number[] = [];
  for (let m = PIANO_LOW; m <= PIANO_HIGH; m++) if (WHITE_PCS.includes(mod12(m))) whites.push(m);
  const W = whites.length * ww + 2;
  const H = wh + (o.compact ? 4 : 24);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: `keyboard${o.compact ? ' compact' : ''}`, role: 'img', 'aria-label': o.label });
  const on = new Set(v.midi);
  const marker = (cx: number, cy: number, m: number) => {
    if (!on.has(m)) return;
    const isRoot = mod12(m) === v.root;
    if (isRoot) svg.append(s('rect', { x: cx - 5, y: cy - 5, width: 10, height: 10, transform: `rotate(45 ${cx} ${cy})`, class: 'mark root' }));
    else svg.append(s('circle', { cx, cy, r: 5, class: 'mark' }));
  };
  whites.forEach((m, i) => {
    const isOn = on.has(m);
    const isRoot = isOn && mod12(m) === v.root;
    svg.append(s('rect', { x: 1 + i * ww, y: 1, width: ww - 1, height: wh, rx: 2, class: `white${isOn ? ' on' : ''}${isRoot ? ' root' : ''}` }));
    marker(1 + i * ww + ww / 2, wh - 12, m);
    if (isOn && !o.compact) svg.append(s('text', { x: 1 + i * ww + ww / 2, y: wh + 17, 'text-anchor': 'middle', class: 'klabel', text: o.noteLabel(mod12(m)) }));
  });
  for (let m = PIANO_LOW; m <= PIANO_HIGH; m++) {
    const pc = mod12(m);
    if (!(pc in BLACK_AFTER)) continue;
    const octave = Math.floor((m - PIANO_LOW) / 12);
    const wi = octave * 7 + BLACK_AFTER[pc]!;
    const bx = 1 + (wi + 1) * ww - bw / 2;
    const isOn = on.has(m);
    const isRoot = isOn && pc === v.root;
    svg.append(s('rect', { x: bx, y: 1, width: bw, height: bh, rx: 2, class: `black${isOn ? ' on' : ''}${isRoot ? ' root' : ''}` }));
    marker(bx + bw / 2, bh - 10, m);
    if (isOn && !o.compact) svg.append(s('text', { x: bx + bw / 2, y: 14, 'text-anchor': 'middle', class: 'klabel on-black', text: o.noteLabel(pc) }));
  }
  return svg;
}
