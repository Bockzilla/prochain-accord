import { t } from '../i18n/i18n';
import { h, setChildren } from '../render/dom';
import { clampBpm, MAX_BPM, MIN_BPM } from '../metronome/meter';
import { progressionsFor, STYLES, type Style } from '../theory/harmony';
import { keySpelling } from '../theory/keys';
import type { AccompanimentController } from './accompaniment-controller';
import { nameOf, type AppContext } from './context';
import { keyPicker } from './key-picker';
import type { MetronomeView } from './metronome-view';
import type { SharedMusic } from './shared';

/** Espace « Accompagner » : boucles d'accords + batterie, et le métronome complet. */
export class AccompanyView {
  readonly el: HTMLElement;
  private nowChord = h('div', { class: 'band-now', 'aria-live': 'polite' });
  private nextChord = h('div', { class: 'band-next' });
  private strip = h('ol', { class: 'loop-strip' });
  private playBtn = h('button', { type: 'button', class: 'primary play' });
  private bpm = h('input', { type: 'number', min: MIN_BPM, max: MAX_BPM, class: 'bpm-input', inputmode: 'numeric' });

  constructor(
    private ctx: AppContext,
    private shared: SharedMusic,
    private acc: AccompanimentController,
    private metroView: MetronomeView,
  ) {
    this.el = h('section', { id: 'view-accompany', class: 'view', 'aria-labelledby': 'tab-accompany' });
    acc.on(() => this.renderLive());
    shared.on(() => {
      if (this.acc.state !== 'playing') this.acc.refresh();
      if (!this.el.hidden) this.render();
    });
    this.playBtn.addEventListener('click', () => (acc.state === 'playing' ? acc.pause() : void acc.play()));
    this.bpm.addEventListener('change', () => {
      ctx.settings.metro.bpm = Math.round(clampBpm(Number(this.bpm.value)));
      ctx.metro.apply(ctx.settings);
      ctx.commit();
      this.bpm.value = String(ctx.settings.metro.bpm);
    });
    this.render();
  }

  render(): void {
    const m = this.ctx.settings.music;
    const loopsTab = h('button', { type: 'button', role: 'tab', 'aria-selected': String(m.accompanySection === 'loops'), text: t('accompany.loops') });
    const metroTab = h('button', { type: 'button', role: 'tab', 'aria-selected': String(m.accompanySection === 'metronome'), text: t('tab.metronome') });
    loopsTab.addEventListener('click', () => this.section('loops'));
    metroTab.addEventListener('click', () => this.section('metronome'));
    const seg = h('nav', { role: 'tablist', class: 'segmented', 'aria-label': t('accompany.sections') }, [loopsTab, metroTab]);
    if (m.accompanySection === 'metronome') {
      this.metroView.render();
      this.el.replaceChildren(seg, this.metroView.el);
      this.metroView.el.hidden = false;
      return;
    }
    this.acc.refresh();
    const styleSel = h('select', { 'aria-label': t('accompany.style') });
    for (const st of STYLES) styleSel.append(h('option', { value: st, text: t(`style.${st}`), selected: st === m.style }));
    styleSel.addEventListener('change', () => {
      m.style = styleSel.value as Style;
      m.progressionId = progressionsFor(m.style)[0]!.id;
      this.changed();
    });
    const progSel = h('select', { 'aria-label': t('accompany.progression') });
    for (const p of progressionsFor(m.style)) progSel.append(h('option', { value: p.id, text: t(`prog.${p.id}`), selected: p.id === m.progressionId }));
    progSel.addEventListener('change', () => {
      m.progressionId = progSel.value;
      this.changed();
    });
    const stop = h('button', { type: 'button', text: `■ ${t('accompany.stop')}` });
    stop.addEventListener('click', () => this.acc.stop());
    const countIn = h('select', { 'aria-label': t('training.countIn') });
    for (const v of [0, 1, 2] as const) countIn.append(h('option', { value: v, text: t(`training.countIn${v}`), selected: v === m.countIn }));
    countIn.addEventListener('change', () => {
      m.countIn = Number(countIn.value) as 0 | 1 | 2;
      this.ctx.commit();
    });
    const vol = (key: 'drums' | 'comp' | 'click') => {
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: m.volumes[key] });
      inp.addEventListener('input', () => {
        m.volumes[key] = Number(inp.value);
        this.acc.refresh();
        this.ctx.commit();
      });
      return h('label', { class: 'field' }, [h('span', { text: t(`accompany.vol.${key}`) }), inp]);
    };
    const phones = h('input', { type: 'checkbox', checked: m.headphones });
    phones.addEventListener('change', () => {
      m.headphones = phones.checked;
      this.ctx.commit();
      this.render();
    });
    const minus = h('button', { type: 'button', class: 'step', text: '−5', 'aria-label': t('accompany.slower') });
    const plus = h('button', { type: 'button', class: 'step', text: '+5', 'aria-label': t('accompany.faster') });
    const bump = (d: number) => {
      this.ctx.settings.metro.bpm = Math.round(clampBpm(this.ctx.settings.metro.bpm + d));
      this.ctx.metro.apply(this.ctx.settings);
      this.ctx.commit();
      this.bpm.value = String(this.ctx.settings.metro.bpm);
    };
    minus.addEventListener('click', () => bump(-5));
    plus.addEventListener('click', () => bump(5));
    this.bpm.value = String(this.ctx.settings.metro.bpm);

    setChildren(this.el, [
      seg,
      h('div', { class: 'card band-display' }, [this.nowChord, this.nextChord, this.strip, h('div', { class: 'row center' }, [this.playBtn, stop])]),
      m.headphones ? null : h('p', { class: 'hint', text: t('accompany.phonesWarning') }),
      h('div', { class: 'card' }, [
        h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: t('accompany.style') }), styleSel]), h('label', { class: 'field' }, [h('span', { text: t('accompany.progression') }), progSel])]),
        keyPicker(this.ctx, this.shared),
        h('div', { class: 'row center' }, [minus, this.bpm, h('span', { class: 'bpm-unit', text: t('metro.bpm') }), plus]),
        h('label', { class: 'field' }, [h('span', { text: t('training.countIn') }), countIn]),
        h('p', { class: 'small', text: t(`styleExplain.${m.style}`) }),
      ]),
      h('details', { class: 'card' }, [h('summary', { text: t('accompany.mix') }), vol('drums'), vol('comp'), vol('click'), h('label', { class: 'check' }, [phones, h('span', { text: t('accompany.headphones') })]), h('p', { class: 'small', text: t('accompany.phonesExplain') })]),
      h('p', { class: 'small', text: t('accompany.original') }),
    ]);
    this.renderLive();
  }

  private section(s: 'loops' | 'metronome'): void {
    this.ctx.settings.music.accompanySection = s;
    this.ctx.commit();
    this.render();
  }

  private changed(): void {
    this.acc.refresh();
    this.ctx.commit();
    this.render();
  }

  /** Mise à jour légère pendant la lecture : accord en cours, suivant, bandeau de la boucle. */
  renderLive(): void {
    const loop = this.acc.loop;
    const key = this.acc.loopKey;
    const sp = keySpelling(key);
    const name = (i: number) => nameOf(this.ctx, loop[i]!, key, sp);
    const st = this.acc.state;
    this.playBtn.textContent = st === 'playing' ? `❚❚ ${t('accompany.pause')}` : `▶ ${st === 'paused' ? t('accompany.resume') : t('accompany.play')}`;
    const i = this.acc.currentIndex;
    if (st === 'playing' && this.acc.countingIn) {
      this.nowChord.textContent = t('accompany.countIn');
      this.nextChord.textContent = loop.length ? t('accompany.next', { chord: name(0) }) : '';
    } else if (i >= 0 && loop.length) {
      this.nowChord.textContent = name(i);
      this.nextChord.textContent = t('accompany.next', { chord: name((i + 1) % loop.length) });
    } else {
      this.nowChord.textContent = loop.length ? name(0) : '…';
      this.nextChord.textContent = t('accompany.ready');
    }
    this.strip.replaceChildren(...loop.map((_, k) => h('li', { class: k === i ? 'cur' : '', 'aria-current': k === i ? 'true' : undefined, text: name(k) })));
  }
}
