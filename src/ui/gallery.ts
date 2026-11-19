import { t } from '../i18n/i18n';
import { buildMascot } from '../mascot/mascot-svg';
import { h, s } from '../render/dom';
import { buildDecor } from '../themes/decor';
import { WORLD_IDS, WORLDS } from '../themes/themes';

/**
 * Galerie (#galerie) : les six mondes et les six costumes de Pik, en grand.
 * Sert à la revue visuelle (sur ordinateur comme sur téléphone).
 */
export function renderGallery(root: HTMLElement): void {
  const grid = h('div', { class: 'gallery' });
  for (const id of WORLD_IDS) {
    const th = WORLDS[id];
    const svg = s('svg', { viewBox: '-500 -330 1000 660', class: 'gallery-world', role: 'img', 'aria-label': t(`worldName.${id}`) });
    svg.append(buildDecor(th));
    // Un îlot témoin
    svg.append(
      s('ellipse', { cx: 0, cy: 150, rx: 190, ry: 50, fill: '#000', opacity: 0.35 }),
      s('path', { d: 'M-180 110 A180 70 0 0 0 180 110 V150 A180 70 0 0 1 -180 150 Z', fill: th.palette.islandSide }),
      s('ellipse', { cx: 0, cy: 110, rx: 180, ry: 70, fill: th.palette.islandTop[0], stroke: th.palette.islandRim, 'stroke-width': 5 }),
    );
    const m = buildMascot(th.costume);
    m.root.setAttribute('transform', 'translate(0 118) scale(2.1)');
    svg.append(m.root);
    grid.append(h('figure', {}, [svg, h('figcaption', { text: t(`worldName.${id}`) })]));
  }
  const back = h('a', { href: './', class: 'primary', text: t('gallery.back') });
  root.replaceChildren(h('main', { class: 'gallery-page' }, [h('h1', { text: t('gallery.title') }), h('p', { class: 'small', text: t('gallery.help') }), grid, back]));
}
