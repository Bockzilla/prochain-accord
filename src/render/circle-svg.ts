import type { Key } from '../theory/keys';
import { mod12 } from '../theory/notes';
import { s } from './dom';

export interface CircleOptions {
  selected: Key;
  majorLabel: (tonic: number) => string;
  minorLabel: (tonic: number) => string;
  title: string;
  onSelect: (k: Key) => void;
}

/**
 * Cercle des quintes : anneau extérieur = tonalités majeures, intérieur = relatives mineures.
 * Les 6 accords de la tonalité choisie (I IV V à l'extérieur, ii iii vi à l'intérieur) sont surlignés ;
 * la tonalité choisie a un contour épais (pas seulement une couleur).
 */
export function renderCircle(o: CircleOptions): SVGElement {
  const size = 320;
  const c = size / 2;
  const rOut = 150;
  const rMid = 104;
  const rIn = 62;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'circle5', role: 'group', 'aria-label': o.title });
  const majorTonic = o.selected.mode === 'major' ? o.selected.tonic : mod12(o.selected.tonic + 3);
  const pos = (tonic: number) => mod12(tonic * 7); // nombre de quintes depuis Do
  const selPos = pos(majorTonic);
  const near = (p: number) => {
    const d = mod12(p - selPos);
    return d === 0 || d === 1 || d === 11;
  };
  const arc = (i: number, r1: number, r2: number) => {
    const a0 = ((i - 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    const p = (r: number, a: number) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
    return `M ${p(r2, a0)} A ${r2} ${r2} 0 0 1 ${p(r2, a1)} L ${p(r1, a1)} A ${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
  };
  const label = (i: number, r: number) => {
    const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) + 5 };
  };
  for (let i = 0; i < 12; i++) {
    const tonic = mod12(i * 7);
    const minorTonic = mod12(tonic + 9);
    const inKey = near(i);
    const majSel = o.selected.mode === 'major' && i === selPos;
    const minSel = o.selected.mode === 'minor' && i === selPos;
    for (const ring of ['major', 'minor'] as const) {
      const isMaj = ring === 'major';
      const sel = isMaj ? majSel : minSel;
      const g = s('g', { class: `seg ${ring}${inKey ? ' inkey' : ''}${sel ? ' sel' : ''}`, role: 'button', tabindex: 0, 'aria-pressed': String(sel), 'aria-label': isMaj ? o.majorLabel(tonic) : o.minorLabel(minorTonic) });
      const lp = label(i, isMaj ? (rOut + rMid) / 2 : (rMid + rIn) / 2);
      g.append(s('path', { d: isMaj ? arc(i, rMid, rOut) : arc(i, rIn, rMid) }), s('text', { x: lp.x, y: lp.y, 'text-anchor': 'middle', text: isMaj ? o.majorLabel(tonic) : o.minorLabel(minorTonic) }));
      const k: Key = isMaj ? { tonic, mode: 'major' } : { tonic: minorTonic, mode: 'minor' };
      g.addEventListener('click', () => o.onSelect(k));
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          o.onSelect(k);
        }
      });
      svg.append(g);
    }
  }
  return svg;
}
