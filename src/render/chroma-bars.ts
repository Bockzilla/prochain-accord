import { h } from './dom';

/** Barres du chromagramme en direct (mode débogage). */
export class ChromaBars {
  readonly el: HTMLElement;
  private bars: HTMLElement[] = [];

  constructor(labels: string[]) {
    this.el = h('div', { class: 'chroma', role: 'img' });
    this.setLabels(labels);
  }

  setLabels(labels: string[]): void {
    this.el.replaceChildren();
    this.bars = labels.map((l) => {
      const fill = h('span', { class: 'fill' });
      this.el.append(h('div', { class: 'bar' }, [fill, h('span', { class: 'lbl', text: l })]));
      return fill;
    });
  }

  update(chroma: ArrayLike<number>, highlight: Set<number>): void {
    this.bars.forEach((b, i) => {
      b.style.height = `${Math.round(Math.max(0, Math.min(1, chroma[i] ?? 0)) * 100)}%`;
      b.classList.toggle('hl', highlight.has(i));
    });
  }
}
