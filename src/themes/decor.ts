import { s } from '../render/dom';
import type { WorldId, WorldTheme } from './themes';

/**
 * Décors des mondes (SVG, coordonnées de la scène : x −500..500, y −330..330).
 * Chaque décor : ciel, texture, éclairage simulé, éléments de scène. Aucun élément ne capte les touches.
 */
const W = 1000;
const H = 660;
const X0 = -500;
const Y0 = -330;

let uid = 0;
const id = (p: string) => `${p}-${++uid}`;

function lin(defs: SVGElement, stops: [number, string, number?][], vertical = true): string {
  const g = id('lg');
  const el = s('linearGradient', { id: g, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 });
  for (const [o, c, op] of stops) el.append(s('stop', { offset: o, 'stop-color': c, 'stop-opacity': op ?? 1 }));
  defs.append(el);
  return `url(#${g})`;
}

function rad(defs: SVGElement, color: string, opacity = 0.8): string {
  const g = id('rg');
  defs.append(s('radialGradient', { id: g }, [s('stop', { offset: 0, 'stop-color': color, 'stop-opacity': opacity }), s('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 })]));
  return `url(#${g})`;
}

function pattern(defs: SVGElement, w: number, h: number, children: SVGElement[]): string {
  const p = id('pt');
  defs.append(s('pattern', { id: p, width: w, height: h, patternUnits: 'userSpaceOnUse' }, children));
  return `url(#${p})`;
}

const glow = (defs: SVGElement, x: number, y: number, r: number, color: string, op = 0.7, cls = '') =>
  s('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, fill: rad(defs, color, op), class: cls });

export function buildDecor(theme: WorldTheme): SVGElement {
  const g = s('g', { class: `decor decor-${theme.id}`, 'aria-hidden': 'true', 'pointer-events': 'none' });
  const defs = s('defs');
  g.append(defs);
  const p = theme.palette;
  g.append(s('rect', { x: X0, y: Y0, width: W, height: H, fill: lin(defs, [[0, p.sky[0]], [0.55, p.sky[1]], [1, p.sky[2]]]) }));
  BUILDERS[theme.id](g, defs, theme);
  // Vignette : assombrit les bords, concentre le regard au centre.
  const v = id('vig');
  defs.append(s('radialGradient', { id: v, cx: 0.5, cy: 0.5, r: 0.75 }, [s('stop', { offset: 0.55, 'stop-color': '#000', 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': theme.id === 'pop' ? 0.12 : 0.55 })]));
  g.append(s('rect', { x: X0, y: Y0, width: W, height: H, fill: `url(#${v})` }));
  return g;
}

type Builder = (g: SVGElement, defs: SVGElement, t: WorldTheme) => void;

const BUILDERS: Record<WorldId, Builder> = {
  // Club nocturne : briques, lampes ambrées, rideaux de velours, reflet au sol.
  blues(g, defs, t) {
    const bricks = pattern(defs, 60, 28, [s('rect', { x: 0, y: 0, width: 60, height: 28, fill: 'none' }), s('path', { d: 'M0 14 H60 M30 0 V14 M0 14 V28 M60 14 V28', stroke: '#7d97d6', 'stroke-width': 1, opacity: 0.18 })]);
    g.append(s('rect', { x: X0, y: Y0, width: W, height: 420, fill: bricks }));
    for (const [x, len] of [[-300, 70], [0, 40], [300, 70]] as const) {
      g.append(glow(defs, x, Y0 + len + 30, 190, t.palette.glow, 0.45, 'flicker-soft'));
      g.append(s('line', { x1: x, y1: Y0, x2: x, y2: Y0 + len, stroke: '#0a0f1e', 'stroke-width': 3 }));
      g.append(s('path', { d: `M${x - 26} ${Y0 + len + 22} L${x - 12} ${Y0 + len} H${x + 12} L${x + 26} ${Y0 + len + 22} Z`, fill: '#2a2216', stroke: '#ffcf7a', 'stroke-width': 1.5 }));
      g.append(s('ellipse', { cx: x, cy: Y0 + len + 24, rx: 18, ry: 5, fill: '#ffe2a3' }));
    }
    const curtain = lin(defs, [[0, '#3a0f2a'], [0.5, '#6b1f45'], [1, '#2a0a1e']], false);
    for (const side of [-1, 1]) {
      const x = side < 0 ? X0 : X0 + W - 120;
      g.append(s('path', { d: side < 0 ? `M${x} ${Y0} H${x + 120} Q${x + 70} ${Y0 + 200} ${x + 110} ${Y0 + H} H${x} Z` : `M${x + 120} ${Y0} H${x} Q${x + 50} ${Y0 + 200} ${x + 10} ${Y0 + H} H${x + 120} Z`, fill: curtain, opacity: 0.85 }));
      for (let k = 1; k < 4; k++) g.append(s('path', { d: `M${x + k * 30} ${Y0} Q${x + k * 30 + side * 10} ${Y0 + 300} ${x + k * 30} ${Y0 + H}`, stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 3, fill: 'none' }));
    }
    g.append(s('text', { x: 360, y: -180, 'font-size': 64, fill: 'none', stroke: '#6fd3ff', 'stroke-width': 2.5, class: 'neon', text: '♫' }));
    g.append(s('ellipse', { cx: 0, cy: 230, rx: 420, ry: 70, fill: rad(defs, t.palette.glow, 0.18) }));
  },
  // Scène électrique : poutre, faisceaux rouges, amplis, foule en ombre.
  rock(g, defs, t) {
    const beam = lin(defs, [[0, t.palette.glow, 0.55], [1, t.palette.glow, 0]]);
    [-330, -110, 110, 330].forEach((x, i) => g.append(s('path', { d: `M${x - 14} ${Y0 + 26} L${x + 14} ${Y0 + 26} L${x + 150 - i * 60} ${Y0 + H} L${x - 150 + i * 40} ${Y0 + H} Z`, fill: beam, class: `beam beam-${i}` })));
    g.append(s('rect', { x: X0, y: Y0 + 8, width: W, height: 22, fill: '#2a2a30', stroke: '#55555e' }));
    let zig = `M${X0} ${Y0 + 30}`;
    for (let x = X0; x <= X0 + W; x += 25) zig += ` L${x} ${Y0 + ((x / 25) % 2 === 0 ? 8 : 30)}`;
    g.append(s('path', { d: zig, stroke: '#6a6a74', 'stroke-width': 2, fill: 'none' }));
    const grill = pattern(defs, 10, 10, [s('circle', { cx: 5, cy: 5, r: 1.6, fill: '#000', opacity: 0.6 })]);
    for (const x of [X0 + 20, X0 + W - 150]) {
      for (let k = 0; k < 2; k++) {
        g.append(s('rect', { x, y: 120 + k * 95, width: 130, height: 90, rx: 8, fill: '#1b1a1f', stroke: '#3b3a42', 'stroke-width': 2 }));
        g.append(s('rect', { x: x + 10, y: 130 + k * 95, width: 110, height: 70, rx: 4, fill: grill }));
      }
    }
    let crowd = `M${X0} ${Y0 + H}`;
    for (let x = X0; x <= X0 + W; x += 34) crowd += ` L${x} ${280 + Math.sin(x * 0.13) * 8} Q${x + 17} ${255 + Math.cos(x) * 10} ${x + 34} ${280}`;
    g.append(s('path', { d: `${crowd} L${X0 + W} ${Y0 + H} Z`, fill: '#050507', opacity: 0.9 }));
    g.append(s('path', { d: 'M380 -250 L350 -190 L372 -190 L345 -130 L405 -205 L380 -205 L400 -250 Z', fill: 'none', stroke: '#ffd23f', 'stroke-width': 3, class: 'neon' }));
  },
  // Forêt douce : collines, arbres ronds et sapins, feu de camp stylisé.
  folk(g, defs, t) {
    g.append(s('circle', { cx: 330, cy: -230, r: 44, fill: '#f6efc9', opacity: 0.85 }));
    g.append(glow(defs, 330, -230, 140, '#f6efc9', 0.25));
    g.append(s('path', { d: `M${X0} 60 Q-250 -40 -40 30 T${X0 + W} 10 V${Y0 + H} H${X0} Z`, fill: '#4f7360', opacity: 0.8 }));
    g.append(s('path', { d: `M${X0} 140 Q-150 60 80 120 T${X0 + W} 100 V${Y0 + H} H${X0} Z`, fill: '#3d5c4c' }));
    const tree = (x: number, y: number, k: number) => {
      g.append(s('rect', { x: x - 6 * k, y, width: 12 * k, height: 50 * k, fill: '#5b3d26' }));
      g.append(s('circle', { cx: x, cy: y - 8 * k, r: 38 * k, fill: '#6f9a64' }), s('circle', { cx: x - 26 * k, cy: y + 10 * k, r: 26 * k, fill: '#5f8a55' }), s('circle', { cx: x + 24 * k, cy: y + 6 * k, r: 28 * k, fill: '#7aa86c' }));
    };
    const pine = (x: number, y: number, k: number) => g.append(s('path', { d: `M${x} ${y - 110 * k} L${x + 45 * k} ${y} H${x - 45 * k} Z`, fill: '#2f4f3c' }), s('rect', { x: x - 5 * k, y, width: 10 * k, height: 20 * k, fill: '#4a3220' }));
    pine(-430, 40, 1.2);
    tree(-360, 60, 1);
    pine(420, 30, 1.3);
    tree(360, 80, 0.9);
    pine(-250, 0, 0.7);
    pine(250, -10, 0.6);
    const grass = pattern(defs, 24, 16, [s('path', { d: 'M4 16 L6 6 M10 16 L12 4 M16 16 L18 8', stroke: '#9cc788', 'stroke-width': 1.2, opacity: 0.35 })]);
    g.append(s('rect', { x: X0, y: 160, width: W, height: 170, fill: grass }));
    // Feu de camp
    // Feu de camp dans le coin, hors de la zone des îlots.
    const fx = -440;
    const fy = 285;
    g.append(glow(defs, fx, fy - 20, 170, t.palette.glow, 0.5, 'flicker'));
    g.append(s('rect', { x: fx - 40, y: fy, width: 80, height: 14, rx: 7, fill: '#6b4a2f', transform: `rotate(12 ${fx} ${fy})` }), s('rect', { x: fx - 40, y: fy, width: 80, height: 14, rx: 7, fill: '#5a3d26', transform: `rotate(-12 ${fx} ${fy})` }));
    g.append(s('path', { d: `M${fx} ${fy - 70} C${fx + 30} ${fy - 30} ${fx + 26} ${fy + 4} ${fx} ${fy + 4} C${fx - 26} ${fy + 4} ${fx - 30} ${fy - 30} ${fx} ${fy - 70} Z`, fill: '#ff9a3c', class: 'flame' }));
    g.append(s('path', { d: `M${fx} ${fy - 40} C${fx + 16} ${fy - 16} ${fx + 14} ${fy + 2} ${fx} ${fy + 2} C${fx - 14} ${fy + 2} ${fx - 16} ${fy - 16} ${fx} ${fy - 40} Z`, fill: '#ffe08a', class: 'flame flame-2' }));
  },
  // Coucher de soleil : soleil rayé, mesas en terre cuite, cactus, clôture.
  country(g, defs, t) {
    g.append(glow(defs, 0, 40, 420, '#ffd27a', 0.4));
    const sun = id('sun');
    defs.append(s('clipPath', { id: sun }, [s('rect', { x: -170, y: -140, width: 340, height: 180 })]));
    g.append(s('circle', { cx: 0, cy: 40, r: 165, fill: lin(defs, [[0, '#ffe08a'], [1, '#ff7a59']]), 'clip-path': `url(#${sun})` }));
    for (let k = 0; k < 4; k++) g.append(s('rect', { x: -170, y: -10 + k * 14, width: 340, height: 4 + k, fill: t.palette.sky[1], opacity: 0.8 }));
    g.append(s('path', { d: `M${X0} 60 L-380 60 L-360 -20 L-230 -20 L-210 60 L120 60 L140 0 L300 0 L320 60 L${X0 + W} 60 V${Y0 + H} H${X0} Z`, fill: '#a4502f' }));
    g.append(s('path', { d: `M${X0} 110 Q0 80 ${X0 + W} 115 V${Y0 + H} H${X0} Z`, fill: lin(defs, [[0, '#d9a35d'], [1, '#8a4a2a']]) }));
    const stripes = pattern(defs, 40, 12, [s('path', { d: 'M0 6 Q10 2 20 6 T40 6', stroke: '#fff1d6', 'stroke-width': 1, fill: 'none', opacity: 0.2 })]);
    g.append(s('rect', { x: X0, y: 110, width: W, height: 220, fill: stripes }));
    const cactus = (x: number, y: number, k: number) =>
      g.append(s('path', { d: `M${x} ${y} V${y - 110 * k} q0 -16 14 -16 q14 0 14 16 V${y} Z M${x} ${y - 50 * k} h-22 q-10 0 -10 -10 V${y - 80 * k} q0 -10 9 -10 q9 0 9 10 V${y - 62 * k} h14 Z M${x + 28} ${y - 64 * k} h22 q10 0 10 -10 V${y - 96 * k} q0 -10 -9 -10 q-9 0 -9 10 V${y - 76 * k} h-14 Z`, fill: '#3f6b4a', stroke: '#2d4f36', 'stroke-width': 2 }));
    cactus(-420, 250, 1.1);
    cactus(400, 230, 0.85);
    for (let x = -260; x <= 260; x += 65) g.append(s('rect', { x, y: 215, width: 8, height: 50, fill: '#6b3a22' }));
    g.append(s('path', { d: 'M-260 228 H268 M-260 246 H268', stroke: '#6b3a22', 'stroke-width': 3 }));
  },
  // Club de jazz raffiné : velours, arches art déco dorées, piano en ombre.
  jazz(g, defs, t) {
    const velvet = pattern(defs, 18, 18, [s('path', { d: 'M0 18 L18 0', stroke: '#8a4fb8', 'stroke-width': 1, opacity: 0.18 })]);
    g.append(s('rect', { x: X0, y: Y0, width: W, height: H, fill: velvet }));
    for (let k = 0; k < 6; k++) g.append(s('path', { d: `M${-330 + k * 22} 60 A${330 - k * 22} ${330 - k * 22} 0 0 1 ${330 - k * 22} 60`, stroke: t.palette.glow, 'stroke-width': k === 0 ? 3 : 1.2, fill: 'none', opacity: 0.55 - k * 0.07 }));
    for (let a = -80; a <= 80; a += 20) {
      const r = (a * Math.PI) / 180;
      g.append(s('line', { x1: 0, y1: 60, x2: Math.sin(r) * 250, y2: 60 - Math.cos(r) * 250, stroke: t.palette.glow, 'stroke-width': 1, opacity: 0.22 }));
    }
    for (const x of [-450, 410]) {
      g.append(s('rect', { x, y: Y0 + 20, width: 40, height: H - 40, fill: '#2a1240', stroke: t.palette.glow, 'stroke-width': 1.5, opacity: 0.9 }));
      for (let k = 1; k < 4; k++) g.append(s('line', { x1: x + k * 10, y1: Y0 + 30, x2: x + k * 10, y2: Y0 + H - 30, stroke: t.palette.glow, opacity: 0.35 }));
    }
    g.append(s('path', { d: 'M230 250 Q240 170 330 170 L420 175 Q440 200 420 230 L400 250 Z M250 250 V300 M395 250 V300', fill: '#0c0614', stroke: '#0c0614', 'stroke-width': 6 }));
    g.append(glow(defs, 0, -60, 300, t.palette.glow, 0.18));
  },
  // Monde pop lumineux : arc-en-ciel pastel, nuages ronds, formes joyeuses.
  pop(g, defs) {
    ['#ffb3d9', '#ffd9a6', '#fff3a6', '#bff2c9', '#a6d8ff', '#d4b8ff'].forEach((c, k) => g.append(s('path', { d: `M${-380 + k * 18} 120 A${380 - k * 18} ${380 - k * 18} 0 0 1 ${380 - k * 18} 120`, stroke: c, 'stroke-width': 18, fill: 'none', opacity: 0.7 })));
    const cloud = (x: number, y: number, k: number) => g.append(s('g', { opacity: 0.95, class: 'drift' }, [s('circle', { cx: x, cy: y, r: 36 * k, fill: '#fff' }), s('circle', { cx: x + 40 * k, cy: y + 8 * k, r: 28 * k, fill: '#fff' }), s('circle', { cx: x - 40 * k, cy: y + 10 * k, r: 26 * k, fill: '#fff' }), s('rect', { x: x - 64 * k, y: y + 8 * k, width: 128 * k, height: 26 * k, rx: 13 * k, fill: '#fff' })]));
    cloud(-330, -220, 1);
    cloud(300, -250, 0.8);
    cloud(380, 40, 0.6);
    const dots = pattern(defs, 36, 36, [s('circle', { cx: 18, cy: 18, r: 3, fill: '#ffffff', opacity: 0.45 })]);
    g.append(s('rect', { x: X0, y: Y0, width: W, height: H, fill: dots }));
    const star = (x: number, y: number, r: number, c: string) => {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        d += `${i ? 'L' : 'M'}${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr} `;
      }
      g.append(s('path', { d: `${d}Z`, fill: c, class: 'twinkle' }));
    };
    star(-420, 40, 22, '#ffd23f');
    star(440, -120, 16, '#ff6fb5');
    star(-200, -280, 12, '#6fd3ff');
    g.append(s('path', { d: `M${X0} 230 Q0 180 ${X0 + W} 230 V${Y0 + H} H${X0} Z`, fill: '#d9c8ff' }));
  },
};
