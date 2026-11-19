import { yinPitch } from '../detection/pitch';
import { GUITAR_STRINGS, TunerStabilizer, type TunerReading } from '../detection/tuner';
import { getLocale, t } from '../i18n/i18n';
import { pcName } from '../i18n/notation';
import { h, s, setChildren } from '../render/dom';
import type { AppContext } from './context';

const FRAME = 4096;

/** Accordeur chromatique / guitare : grande aiguille, zone verte, rejet des signaux instables. */
export class TunerView {
  readonly el: HTMLElement;
  private stab: TunerStabilizer;
  private needle!: SVGElement;
  private noteEl = h('div', { class: 'tuner-note', 'aria-live': 'polite' });
  private centsEl = h('div', { class: 'tuner-cents' });
  private freqEl = h('div', { class: 'tuner-freq' });
  private stateEl = h('div', { class: 'tuner-state' });
  private stringsEl = h('div', { class: 'tuner-strings' });
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSeen = 0;

  constructor(
    private ctx: AppContext,
    private onMicRequest: () => void,
  ) {
    this.el = h('div', { class: 'tuner' });
    this.stab = new TunerStabilizer(ctx.settings.tuner.mode, ctx.settings.a4);
    this.render();
  }

  render(): void {
    const st = this.ctx.settings;
    this.stab.mode = st.tuner.mode;
    this.stab.a4 = st.a4;
    const gauge = this.gauge();
    const modeBtns = (['guitar', 'chromatic'] as const).map((m) => {
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(st.tuner.mode === m), text: t(`tuner.mode.${m}`) });
      b.addEventListener('click', () => {
        st.tuner.mode = m;
        this.stab.reset();
        this.ctx.commit();
        this.render();
      });
      return b;
    });
    const a4 = h('input', { type: 'number', min: 415, max: 466, step: 1, value: st.a4, inputmode: 'numeric', 'aria-label': t('settings.a4') });
    a4.addEventListener('change', () => {
      st.a4 = Math.max(415, Math.min(466, Math.round(Number(a4.value) || 440)));
      a4.value = String(st.a4);
      this.stab.a4 = st.a4;
      this.ctx.commit();
    });
    const mic = this.ctx.engine.micActive ? null : h('button', { type: 'button', class: 'primary', text: t('mic.start') });
    mic?.addEventListener('click', () => this.onMicRequest());
    setChildren(this.el, [
      h('nav', { role: 'tablist', class: 'segmented', 'aria-label': t('tuner.title') }, modeBtns),
      h('div', { class: 'card tuner-card' }, [gauge, this.noteEl, this.centsEl, this.stateEl, this.freqEl, st.tuner.mode === 'guitar' ? this.stringsEl : null]),
      mic,
      h('div', { class: 'row center small' }, [h('span', { text: t('settings.a4') }), a4]),
      h('p', { class: 'small', text: t('tuner.help') }),
    ]);
    this.renderStrings(null);
    this.show(null);
  }

  private gauge(): SVGElement {
    const W = 300;
    const H = 170;
    const cx = W / 2;
    const cy = 155;
    const r = 130;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tuner-gauge', 'aria-hidden': 'true' });
    const pt = (cents: number, rr: number) => {
      const a = ((cents / 50) * 60 - 90) * (Math.PI / 180);
      return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) };
    };
    const arc = (c0: number, c1: number, rr: number) => {
      const a = pt(c0, rr);
      const b = pt(c1, rr);
      return `M ${a.x} ${a.y} A ${rr} ${rr} 0 0 1 ${b.x} ${b.y}`;
    };
    svg.append(s('path', { d: arc(-50, 50, r), class: 'g-track' }), s('path', { d: arc(-5, 5, r), class: 'g-zone' }));
    for (let c = -50; c <= 50; c += 10) {
      const a = pt(c, r - 12);
      const b = pt(c, r + 2);
      svg.append(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: c === 0 ? 'g-tick zero' : 'g-tick' }));
      if (c % 50 === 0 && c !== 0) {
        const l = pt(c, r + 16);
        svg.append(s('text', { x: l.x, y: l.y, 'text-anchor': 'middle', class: 'g-label', text: c > 0 ? `+${c}` : String(c) }));
      }
    }
    this.needle = s('g', { class: 'g-needle' }, [s('line', { x1: cx, y1: cy, x2: cx, y2: cy - r + 8 }), s('circle', { cx, cy, r: 9 })]);
    svg.append(this.needle);
    return svg;
  }

  private renderStrings(r: TunerReading | null): void {
    this.stringsEl.replaceChildren(
      ...GUITAR_STRINGS.map((m, i) =>
        h('span', { class: `tstring${r?.string === i ? (r.inTune ? ' on ok' : ' on') : ''}`, text: pcName(m % 12, this.ctx.settings.notation, getLocale()) + (i === 0 ? '₂' : i === 5 ? '₄' : '') }),
      ),
    );
  }

  private show(r: TunerReading | null): void {
    const cents = r ? Math.max(-50, Math.min(50, r.cents)) : 0;
    this.needle.style.transform = `rotate(${(cents / 50) * 60}deg)`;
    this.needle.classList.toggle('ok', !!r?.inTune);
    this.needle.classList.toggle('idle', !r);
    if (!r) {
      this.noteEl.textContent = '—';
      this.centsEl.textContent = '';
      this.freqEl.textContent = '';
      this.stateEl.textContent = this.ctx.engine.micActive ? t('tuner.waiting') : t('tuner.micOff');
      this.stateEl.className = 'tuner-state';
      this.renderStrings(null);
      return;
    }
    const octave = Math.floor(r.target / 12) - 1;
    this.noteEl.textContent = `${pcName(r.target % 12, this.ctx.settings.notation, getLocale())}${octave}`;
    const c = Math.round(r.cents);
    this.centsEl.textContent = `${c > 0 ? '+' : ''}${c} ${t('tuner.cents')}`;
    this.freqEl.textContent = `${r.freq.toFixed(1)} Hz`;
    this.stateEl.textContent = !r.stable ? t('tuner.unstable') : r.inTune ? t('tuner.inTune') : r.cents < 0 ? t('tuner.tooLow') : t('tuner.tooHigh');
    this.stateEl.className = `tuner-state ${!r.stable ? 'unstable' : r.inTune ? 'ok' : 'off'}`;
    this.renderStrings(r);
  }

  /** Démarre / arrête la mesure (seulement quand l'accordeur est visible). */
  setActive(on: boolean): void {
    if (on && !this.timer) {
      this.timer = setInterval(() => this.tick(), 45);
    } else if (!on && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.stab.reset();
    }
  }

  private tick(): void {
    const e = this.ctx.engine;
    e.pollFallback();
    // Analyse dès qu'un signal récent arrive (micro, interface, ou signal de test en mode débogage).
    const fresh = e.ring.lastFrame > (e.ctx.currentTime - 0.3) * e.sampleRate;
    if (!fresh) return this.show(null);
    const frame = e.ring.read(FRAME, e.ring.lastFrame);
    if (!frame) return;
    const r = this.stab.update(yinPitch(frame, e.sampleRate));
    if (r) {
      this.lastSeen = performance.now();
      this.show(r);
    } else if (performance.now() - this.lastSeen > 900) {
      this.show(null);
    }
  }
}
