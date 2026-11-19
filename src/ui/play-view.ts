import { t } from '../i18n/i18n';
import { h } from '../render/dom';
import type { ChordsView } from './chords-view';
import type { AppContext } from './context';
import type { TunerView } from './tuner-view';

/** Espace « Jouer » : le monde des accords (détection) ou l'accordeur. */
export class PlayView {
  readonly el: HTMLElement;
  private seg = h('nav', { role: 'tablist', class: 'segmented play-seg' });

  constructor(
    private ctx: AppContext,
    private chords: ChordsView,
    private tuner: TunerView,
    private extraTop: HTMLElement | null = null,
  ) {
    this.el = h('section', { id: 'view-play', class: 'view', 'aria-labelledby': 'tab-play' });
    this.render();
  }

  setTop(el: HTMLElement): void {
    this.extraTop = el;
    this.render();
  }

  render(): void {
    const v = this.ctx.settings.playView;
    const tab = (id: 'world' | 'tuner', label: string) => {
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(v === id), text: label });
      b.addEventListener('click', () => {
        this.ctx.settings.playView = id;
        this.ctx.commit();
        this.render();
      });
      return b;
    };
    this.seg.replaceChildren(tab('world', t('play.chordsTab')), tab('tuner', t('play.tunerTab')));
    this.chords.render();
    this.tuner.render();
    const chordsWrap = h('div', { class: 'play-chords' }, this.extraTop ? [this.extraTop, this.chords.el] : [this.chords.el]);
    chordsWrap.hidden = v !== 'world';
    this.tuner.el.hidden = v !== 'tuner';
    this.el.replaceChildren(this.seg, chordsWrap, this.tuner.el);
    this.syncActive();
  }

  /** L'accordeur ne mesure que lorsqu'il est visible. */
  onWorldVisible: ((v: boolean) => void) | null = null;

  syncActive(): void {
    this.tuner.setActive(!this.el.hidden && this.ctx.settings.playView === 'tuner');
    this.onWorldVisible?.(!this.el.hidden && this.ctx.settings.playView === 'world');
  }
}
