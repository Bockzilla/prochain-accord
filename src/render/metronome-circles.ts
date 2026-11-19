import type { BeatState, Subdivision } from '../metronome/meter';
import { h } from './dom';

export interface CirclesOptions {
  states: BeatState[];
  groupStarts: Set<number>;
  subdivision: Subdivision;
  compact: boolean;
  /** Toucher un cercle (non fourni = non cliquable). */
  onToggle?: (beat: number) => void;
  beatLabel: (beat: number, state: BeatState) => string;
}

/**
 * Rangée de cercles (un par temps) + petits points de subdivision entre les cercles.
 * Les états se distinguent par la couleur ET par la forme / le symbole :
 * accentué = grand cercle plein avec « > », normal = cercle avec point, muet = cercle pointillé avec « × ».
 */
export class MetronomeCircles {
  readonly el: HTMLElement;
  private beats: HTMLElement[] = [];
  private subs: HTMLElement[][] = [];
  private active: HTMLElement | null = null;

  constructor(private o: CirclesOptions) {
    this.el = h('div', { class: `circles${o.compact ? ' compact' : ''}` });
    this.build();
  }

  update(o: Partial<CirclesOptions>): void {
    this.o = { ...this.o, ...o };
    this.build();
  }

  private build(): void {
    this.el.replaceChildren();
    this.beats = [];
    this.subs = [];
    this.o.states.forEach((st, i) => {
      const glyph = st === 'accent' ? '>' : st === 'mute' ? '×' : '•';
      const cls = ['beat', st, i === 0 ? 'first' : '', this.o.groupStarts.has(i) && i > 0 ? 'group' : ''].filter(Boolean).join(' ');
      const tag = this.o.onToggle ? 'button' : 'span';
      const b = h(tag as 'button', { class: cls, 'aria-label': this.o.beatLabel(i, st), type: tag === 'button' ? 'button' : undefined, 'data-beat': i }, [
        h('span', { class: 'glyph', 'aria-hidden': 'true', text: glyph }),
      ]);
      if (this.o.onToggle) b.addEventListener('click', () => this.o.onToggle!(i));
      this.el.append(b);
      this.beats.push(b);
      const dots: HTMLElement[] = [];
      for (let k = 1; k < this.o.subdivision; k++) {
        const d = h('span', { class: 'subdot', 'aria-hidden': 'true' });
        this.el.append(d);
        dots.push(d);
      }
      this.subs.push(dots);
    });
  }

  /** Allume le temps `beat` (sub = 0) ou un point de subdivision (sub ≥ 1). */
  light(beat: number, sub: number): void {
    const target = sub === 0 ? this.beats[beat] : this.subs[beat]?.[sub - 1];
    if (!target) return;
    this.active?.classList.remove('active');
    target.classList.remove('active');
    void target.offsetWidth; // relance l'animation de pulsation
    target.classList.add('active');
    this.active = target;
  }

  clearActive(): void {
    this.active?.classList.remove('active');
    this.active = null;
  }
}
