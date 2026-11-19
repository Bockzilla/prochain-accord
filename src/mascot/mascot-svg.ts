import { s } from '../render/dom';
import type { CostumeId } from '../themes/themes';

/**
 * « Pik », mascotte originale de Prochain Accord : un médiator vivant, cartoon doux.
 * Repère local : pieds en (0, 0), tête vers −y (environ 110 unités de haut).
 * L'identité (couleur corail-orange, forme de médiator, mèche en croche) est commune à tous les mondes ;
 * seuls les costumes changent.
 */
export interface MascotParts {
  root: SVGElement; // position dans le monde
  body: SVGElement; // reçoit saut / écrasement / balancement
  armL: SVGElement;
  armR: SVGElement;
  mouth: SVGElement;
  eyes: SVGElement;
  badge: SVGElement; // numéro du temps
  badgeText: SVGElement;
  shadow: SVGElement;
  costume: SVGElement;
}

let n = 0;

export function buildMascot(costume: CostumeId): MascotParts {
  const k = ++n;
  const defs = s('defs');
  defs.append(
    s('radialGradient', { id: `pik-body-${k}`, cx: 0.38, cy: 0.3, r: 0.85 }, [
      s('stop', { offset: 0, 'stop-color': '#ffd7b8' }),
      s('stop', { offset: 0.35, 'stop-color': '#ff9f6b' }),
      s('stop', { offset: 0.8, 'stop-color': '#f2603f' }),
      s('stop', { offset: 1, 'stop-color': '#c9432f' }),
    ]),
    s('radialGradient', { id: `pik-shadow-${k}` }, [s('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0.45 }), s('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0 })]),
  );
  const shadow = s('ellipse', { cx: 0, cy: 2, rx: 38, ry: 10, fill: `url(#pik-shadow-${k})`, class: 'pik-shadow' });

  const bodyPath = 'M0 -4 C-18 -10 -46 -46 -45 -68 C-44 -92 -22 -100 0 -100 C22 -100 44 -92 45 -68 C46 -46 18 -10 0 -4 Z';
  const feet = s('g', { class: 'pik-feet' }, [s('ellipse', { cx: -14, cy: -3, rx: 11, ry: 6, fill: '#c9432f' }), s('ellipse', { cx: 14, cy: -3, rx: 11, ry: 6, fill: '#c9432f' })]);
  const armL = s('g', { class: 'pik-arm', transform: 'translate(-40 -52)' }, [s('rect', { x: -16, y: -6, width: 20, height: 12, rx: 6, fill: '#f2734a', transform: 'rotate(20)' })]);
  const armR = s('g', { class: 'pik-arm', transform: 'translate(40 -52)' }, [s('rect', { x: -4, y: -6, width: 20, height: 12, rx: 6, fill: '#f2734a', transform: 'rotate(-20)' })]);
  const tuft = s('path', { d: 'M2 -100 C2 -118 18 -122 20 -112 C14 -116 8 -112 9 -101', fill: '#f2603f', stroke: '#c9432f', 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const tuftDot = s('ellipse', { cx: 20, cy: -112, rx: 6, ry: 5, fill: '#f2603f', stroke: '#c9432f', 'stroke-width': 2 });
  const eye = (x: number) =>
    s('g', {}, [s('ellipse', { cx: x, cy: -64, rx: 10, ry: 12.5, fill: '#fff' }), s('ellipse', { cx: x + 1.5, cy: -62, rx: 6, ry: 7.5, fill: '#24140e' }), s('circle', { cx: x + 4, cy: -66, r: 2.6, fill: '#fff' })]);
  const eyes = s('g', { class: 'pik-eyes' }, [eye(-15), eye(15)]);
  const cheeks = s('g', { opacity: 0.55 }, [s('ellipse', { cx: -27, cy: -46, rx: 7, ry: 4.5, fill: '#ff5f7e' }), s('ellipse', { cx: 27, cy: -46, rx: 7, ry: 4.5, fill: '#ff5f7e' })]);
  const mouth = s('path', { d: 'M-8 -44 Q0 -36 8 -44', stroke: '#5a1f12', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', class: 'pik-mouth' });
  const shine = s('ellipse', { cx: -18, cy: -84, rx: 12, ry: 7, fill: '#fff', opacity: 0.45, transform: 'rotate(-25 -18 -84)' });

  const back = s('g', { class: 'pik-costume-back' });
  const front = s('g', { class: 'pik-costume-front' });
  COSTUMES[costume](back, front, k);

  const body = s('g', { class: 'pik-body' }, [
    back,
    feet,
    s('path', { d: bodyPath, fill: `url(#pik-body-${k})`, stroke: '#b63c29', 'stroke-width': 2.5 }),
    shine,
    tuft,
    tuftDot,
    cheeks,
    eyes,
    mouth,
    armL,
    armR,
    front,
  ]);
  const badgeText = s('text', { x: 0, y: 6, 'text-anchor': 'middle', class: 'pik-badge-num', text: '' });
  // Groupe intérieur : les animations CSS (pulsation, accent) n'écrasent pas la position SVG.
  const badge = s('g', { class: 'pik-badge', transform: 'translate(0 -142)' }, [s('g', { class: 'pik-badge-inner' }, [s('circle', { r: 17, class: 'pik-badge-bg' }), badgeText])]);
  const root = s('g', { class: `pik costume-${costume}` }, [defs, shadow, body, badge]);
  return { root, body, armL, armR, mouth, eyes, badge, badgeText, shadow, costume: front };
}

type CostumeBuilder = (back: SVGElement, front: SVGElement, k: number) => void;

/** Costumes et accessoires par monde (dessins originaux). */
const COSTUMES: Record<CostumeId, CostumeBuilder> = {
  // Blues : feutre bleu nuit à ruban ambré, col de veste élégant.
  fedora(_back, front) {
    front.append(
      s('path', { d: 'M-34 -26 L-10 -8 L0 -20 L10 -8 L34 -26 C26 -10 14 -4 0 -4 C-14 -4 -26 -10 -34 -26 Z', fill: '#1c2c5a', stroke: '#0e1838', 'stroke-width': 2 }),
      s('ellipse', { cx: 0, cy: -100, rx: 50, ry: 10, fill: '#18254d', stroke: '#0b1430', 'stroke-width': 2 }),
      s('path', { d: 'M-30 -102 C-30 -128 -16 -134 0 -128 C16 -134 30 -128 30 -102 Z', fill: '#22346a', stroke: '#0b1430', 'stroke-width': 2 }),
      s('rect', { x: -30, y: -110, width: 60, height: 7, fill: '#ffb340' }),
    );
  },
  // Rock : bandeau rouge aux pans flottants, col de veste de scène clouté, éclair.
  stage(_back, front) {
    front.append(
      s('path', { d: 'M-36 -30 L-12 -8 L0 -16 L12 -8 L36 -30 C28 -12 14 -4 0 -4 C-14 -4 -28 -12 -36 -30 Z', fill: '#1b1a1f', stroke: '#000', 'stroke-width': 2 }),
      ...[-22, -12, 12, 22].map((x) => s('circle', { cx: x, cy: x < 0 ? -16 - (x + 22) * -0.3 : -16 + (x - 22) * 0.3, r: 2.2, fill: '#d9d9e0' })),
      s('path', { d: 'M-44 -84 Q0 -94 44 -84 L44 -76 Q0 -86 -44 -76 Z', fill: '#ff3b4a', stroke: '#a3141f', 'stroke-width': 1.5 }),
      s('path', { d: 'M43 -82 L62 -92 L58 -78 L70 -72 L44 -76 Z', fill: '#ff3b4a', stroke: '#a3141f', 'stroke-width': 1.5, class: 'flutter' }),
      s('path', { d: 'M4 -30 L-2 -20 L3 -20 L-1 -11 L8 -23 L3 -23 L7 -30 Z', fill: '#ffd23f' }),
    );
  },
  // Folk : écharpe tricotée vert sauge, petite guitare acoustique dans le dos.
  scarf(back, front) {
    back.append(
      // Guitare acoustique en bandoulière : le manche dépasse derrière l'épaule droite.
      s('g', { transform: 'translate(34 -18) rotate(28) scale(1.15)' }, [
        s('rect', { x: -4, y: -78, width: 8, height: 46, fill: '#8a5a33' }),
        s('ellipse', { cx: 0, cy: -20, rx: 20, ry: 16, fill: '#d9a35d', stroke: '#8a5a33', 'stroke-width': 2 }),
        s('ellipse', { cx: 0, cy: -38, rx: 15, ry: 12, fill: '#d9a35d', stroke: '#8a5a33', 'stroke-width': 2 }),
        s('circle', { cx: 0, cy: -27, r: 5, fill: '#5a3d26' }),
      ]),
    );
    front.append(
      s('path', { d: 'M-38 -40 Q0 -26 38 -40 L36 -30 Q0 -16 -36 -30 Z', fill: '#7fa86e', stroke: '#4f7a45', 'stroke-width': 2 }),
      s('path', { d: 'M18 -32 L26 -6 L16 -4 L10 -28 Z', fill: '#7fa86e', stroke: '#4f7a45', 'stroke-width': 2 }),
      ...[-24, -12, 0, 12, 24].map((x) => s('line', { x1: x, y1: -38 + Math.abs(x) * 0.08, x2: x + 2, y2: -28 + Math.abs(x) * 0.08, stroke: '#4f7a45', 'stroke-width': 1.5 })),
    );
  },
  // Country : chapeau de cow-boy à bord relevé, bottes stylisées.
  cowboy(_back, front) {
    front.append(
      s('path', { d: 'M-24 -4 L-24 -14 Q-24 -20 -16 -20 H-6 V-4 Z M6 -4 V-20 H16 Q24 -20 24 -14 V-4 Z', fill: '#7a4524', stroke: '#4a2812', 'stroke-width': 2 }),
      s('path', { d: 'M-26 -2 H-4 M4 -2 H26', stroke: '#3f6aa1', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      s('path', { d: 'M-58 -104 Q-50 -92 -30 -98 Q0 -92 30 -98 Q50 -92 58 -104 Q46 -110 30 -104 Q0 -96 -30 -104 Q-46 -110 -58 -104 Z', fill: '#c98c4b', stroke: '#7a4c22', 'stroke-width': 2 }),
      s('path', { d: 'M-26 -102 C-26 -126 -14 -132 -2 -124 L0 -128 L2 -124 C14 -132 26 -126 26 -102 Z', fill: '#d9a35d', stroke: '#7a4c22', 'stroke-width': 2 }),
      s('path', { d: 'M-26 -106 Q0 -100 26 -106', stroke: '#3f6aa1', 'stroke-width': 4, fill: 'none' }),
    );
  },
  // Jazz : revers de costume violet, nœud papillon doré, pochette.
  suit(_back, front) {
    front.append(
      s('path', { d: 'M-40 -34 L-10 -6 L0 -24 L10 -6 L40 -34 C30 -12 14 -4 0 -4 C-14 -4 -30 -12 -40 -34 Z', fill: '#4a1f6e', stroke: '#2a1240', 'stroke-width': 2 }),
      s('path', { d: 'M-12 -34 L0 -28 L12 -34 L12 -22 L0 -28 L-12 -22 Z', fill: '#e8c160', stroke: '#9a7a2a', 'stroke-width': 1.5 }),
      s('circle', { cx: 0, cy: -28, r: 3, fill: '#c9a040' }),
      s('path', { d: 'M22 -26 L30 -30 L32 -22 Z', fill: '#e8c160' }),
    );
  },
  // Pop : lunettes en étoile roses, casque coloré.
  shades(_back, front) {
    const star = (cx: number, cy: number, r: number) => {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 ? r * 0.5 : r;
        d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)} `;
      }
      return s('path', { d: `${d}Z`, fill: '#ff6fb5', stroke: '#c2307a', 'stroke-width': 2, opacity: 0.92 });
    };
    front.append(
      s('path', { d: 'M-46 -66 C-46 -114 46 -114 46 -66', stroke: '#6fd3ff', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }),
      s('rect', { x: -54, y: -76, width: 14, height: 24, rx: 6, fill: '#ffd23f', stroke: '#c79b00', 'stroke-width': 2 }),
      s('rect', { x: 40, y: -76, width: 14, height: 24, rx: 6, fill: '#ffd23f', stroke: '#c79b00', 'stroke-width': 2 }),
      star(-15, -64, 15),
      star(15, -64, 15),
      s('line', { x1: -2, y1: -66, x2: 2, y2: -66, stroke: '#c2307a', 'stroke-width': 3 }),
    );
  },
};
