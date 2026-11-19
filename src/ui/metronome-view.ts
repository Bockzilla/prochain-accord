import { t } from '../i18n/i18n';
import { clampBpm, cycleBeatState, defaultBeatStates, MAX_BPM, MIN_BPM, SIGNATURES, type BeatState, type Subdivision } from '../metronome/meter';
import { loadPresets, savePresets, type Preset, type SoundId } from '../metronome/presets';
import type { TickEvent } from '../metronome/scheduler';
import { TapTempo } from '../metronome/tap-tempo';
import { h } from '../render/dom';
import { MetronomeCircles } from '../render/metronome-circles';
import type { AppContext } from './context';
import { MetronomeController } from './metronome-controller';

const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

/** Onglet Métronome + barre compacte (affichée dans l'onglet Accords). */
export class MetronomeView {
  readonly el: HTMLElement;
  readonly compact: HTMLElement;
  private circles!: MetronomeCircles;
  private miniCircles!: MetronomeCircles;
  private bpmBig = h('output', { class: 'bpm-big', 'aria-live': 'off' });
  private bpmMini = h('span', { class: 'bpm-mini' });
  private barLine = h('div', { class: 'bar-line' });
  private playBtn = h('button', { type: 'button', class: 'play primary' });
  private miniPlay = h('button', { type: 'button', class: 'play mini' });
  private bpmInput = h('input', { type: 'number', min: MIN_BPM, max: MAX_BPM, step: 1, inputmode: 'numeric', class: 'bpm-input' });
  private slider = h('input', { type: 'range', min: MIN_BPM, max: MAX_BPM, step: 1, class: 'bpm-slider' });
  private tapBtn = h('button', { type: 'button', class: 'tap' });
  private tap = new TapTempo();
  private presets: Preset[] = loadPresets(store);

  constructor(private ctx: AppContext) {
    this.el = h('section', { id: 'view-metronome', class: 'view', 'aria-labelledby': 'tab-metronome' });
    this.compact = h('div', { class: 'compact-metro' });
    ctx.metro.onVisual((e) => this.onBeat(e));
    ctx.metro.onState(() => this.renderPlay());
    this.playBtn.addEventListener('click', () => ctx.metro.toggle());
    this.miniPlay.addEventListener('click', () => ctx.metro.toggle());
    this.bpmInput.addEventListener('change', () => this.setBpm(Number(this.bpmInput.value)));
    this.slider.addEventListener('input', () => this.setBpm(Number(this.slider.value)));
    this.tapBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const bpm = this.tap.tap(performance.now() / 1000);
      this.tapBtn.textContent = this.tap.tapCount >= 2 ? t('metro.tapCount', { n: this.tap.tapCount }) : t('metro.tap');
      if (bpm) this.setBpm(Math.round(bpm));
    });
    this.render();
  }

  private get m() {
    return this.ctx.settings.metro;
  }

  private setBpm(v: number): void {
    const bpm = Math.round(clampBpm(v));
    this.m.bpm = bpm;
    this.ctx.metro.apply(this.ctx.settings);
    this.ctx.commit();
    this.renderBpm();
  }

  private stepButton(delta: number): HTMLButtonElement {
    const b = h('button', { type: 'button', class: 'step', 'aria-label': t(delta > 0 ? 'metro.plus' : 'metro.minus'), text: delta > 0 ? '+1' : '−1' });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let repeat: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearTimeout(timer);
      clearInterval(repeat);
    };
    // Appui court = ±1 ; appui long = ±5 répété (interface uniquement : n'affecte pas l'horloge des clics).
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.setBpm(this.m.bpm + delta);
      timer = setTimeout(() => {
        repeat = setInterval(() => this.setBpm(this.m.bpm + delta * 5), 180);
      }, 450);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    return b;
  }

  private beatLabel = (i: number, st: BeatState) => t('metro.beatLabel', { n: i + 1, state: t(`beat.${st}`) });

  private toggleBeat = (i: number) => {
    const states = [...this.ctx.metro.scheduler.config.beatStates];
    states[i] = cycleBeatState(states[i] ?? 'normal');
    this.m.beatStates = states;
    this.ctx.metro.apply(this.ctx.settings);
    this.ctx.commit();
    this.renderCircles();
  };

  private renderCircles(): void {
    const cfg = this.ctx.metro.scheduler.config;
    const opts = { states: [...cfg.beatStates], groupStarts: this.ctx.metro.groupStarts, subdivision: cfg.subdivision, beatLabel: this.beatLabel };
    if (!this.circles) {
      this.circles = new MetronomeCircles({ ...opts, compact: false, onToggle: this.toggleBeat });
      this.miniCircles = new MetronomeCircles({ ...opts, compact: true });
    } else {
      this.circles.update(opts);
      this.miniCircles.update(opts);
    }
  }

  private renderBpm(): void {
    const bpm = this.m.bpm;
    this.bpmBig.textContent = String(bpm);
    this.bpmMini.textContent = t('metro.bpmShort', { n: bpm });
    if (document.activeElement !== this.bpmInput) this.bpmInput.value = String(bpm);
    this.slider.value = String(bpm);
  }

  private renderPlay(): void {
    const on = this.ctx.metro.running;
    this.playBtn.textContent = on ? `■ ${t('metro.stop')}` : `▶ ${t('metro.start')}`;
    this.miniPlay.textContent = on ? '■' : '▶';
    this.miniPlay.setAttribute('aria-label', on ? t('metro.stop') : t('metro.start'));
    this.playBtn.setAttribute('aria-pressed', String(on));
    if (!on) {
      this.circles?.clearActive();
      this.miniCircles?.clearActive();
      this.barLine.textContent = t('metro.stopped');
    }
  }

  private onBeat(e: TickEvent): void {
    this.circles.light(e.beat, e.sub);
    this.miniCircles.light(e.beat, e.sub);
    if (e.sub === 0) {
      this.barLine.textContent = e.countIn ? t('metro.countIn', { n: -e.bar }) : t('metro.bar', { n: e.bar + 1 });
      if (e.bpm !== this.m.bpm && this.m.accel.enabled) this.bpmBig.textContent = String(Math.round(e.bpm));
      this.el.classList.toggle('silent-bar', !e.audible && !e.countIn);
    }
  }

  private select<T extends string | number>(label: string, value: T, options: { v: T; label: string }[], onChange: (v: T) => void): HTMLElement {
    const sel = h('select', { 'aria-label': label });
    for (const o of options) sel.append(h('option', { value: String(o.v), text: o.label, selected: o.v === value }));
    sel.addEventListener('change', () => {
      const raw = sel.value;
      const v = (typeof value === 'number' ? Number(raw) : raw) as T;
      onChange(v);
    });
    return h('label', { class: 'field' }, [h('span', { text: label }), sel]);
  }

  private number(label: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
    const inp = h('input', { type: 'number', min, max, value, inputmode: 'numeric' });
    inp.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, Math.round(Number(inp.value) || min)));
      inp.value = String(v);
      onChange(v);
    });
    return h('label', { class: 'field' }, [h('span', { text: label }), inp]);
  }

  private check(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const inp = h('input', { type: 'checkbox', checked: value });
    inp.addEventListener('change', () => onChange(inp.checked));
    return h('label', { class: 'check' }, [inp, h('span', { text: label })]);
  }

  private range(label: string, value: number, onChange: (v: number) => void): HTMLElement {
    const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value });
    inp.addEventListener('input', () => onChange(Number(inp.value)));
    return h('label', { class: 'field' }, [h('span', { text: label }), inp]);
  }

  private changed(rebuild = false): void {
    this.ctx.metro.apply(this.ctx.settings);
    this.ctx.commit();
    if (rebuild) this.render();
  }

  render(): void {
    const m = this.m;
    this.renderCircles();
    const isCustom = m.signatureId.startsWith('custom:');
    const sigOptions = [...SIGNATURES.map((s) => ({ v: s.id, label: s.id })), { v: 'custom', label: t('metro.custom') }];
    const sigField = this.select(t('metro.signature'), isCustom ? 'custom' : m.signatureId, sigOptions, (v) => {
      m.signatureId = v === 'custom' ? `custom:${m.beatStates.length || 4}` : v;
      m.beatStates = defaultBeatStates(MetronomeController.signatureOf(m.signatureId));
      this.changed(true);
    });
    const customField = isCustom
      ? this.number(t('metro.customBeats'), Number(m.signatureId.slice(7)), 1, 16, (v) => {
          m.signatureId = `custom:${v}`;
          m.beatStates = defaultBeatStates(MetronomeController.signatureOf(m.signatureId));
          this.changed(true);
        })
      : null;
    const subField = this.select<Subdivision>(t('metro.subdivision'), m.subdivision, ([1, 2, 3, 4] as Subdivision[]).map((v) => ({ v, label: t(`subdiv.${v}`) })), (v) => {
      m.subdivision = v;
      this.changed(true);
    });
    const soundField = this.select<SoundId>(t('metro.sound'), m.sound, (['click', 'wood', 'hihat', 'beep'] as SoundId[]).map((v) => ({ v, label: t(`sound.${v}`) })), (v) => {
      m.sound = v;
      this.changed();
    });

    // Préréglages
    const presetName = h('input', { type: 'text', maxlength: 40, placeholder: t('presets.namePlaceholder'), 'aria-label': t('presets.name') });
    const saveBtn = h('button', { type: 'button', text: t('presets.save') });
    saveBtn.addEventListener('click', () => {
      const name = presetName.value.trim() || `${m.bpm} — ${m.signatureId.replace('custom:', '')}`;
      this.presets = [...this.presets.filter((p) => p.name !== name), { name, bpm: m.bpm, signatureId: m.signatureId, beatStates: [...m.beatStates], subdivision: m.subdivision, sound: m.sound }];
      savePresets(store, this.presets);
      this.render();
    });
    const presetList = h('ul', { class: 'presets' });
    for (const p of this.presets) {
      const load = h('button', { type: 'button', class: 'link', text: p.name });
      load.addEventListener('click', () => {
        Object.assign(m, { bpm: p.bpm, signatureId: p.signatureId, beatStates: [...p.beatStates], subdivision: p.subdivision, sound: p.sound });
        this.changed(true);
      });
      const del = h('button', { type: 'button', class: 'icon', 'aria-label': t('presets.delete', { name: p.name }), text: '✕' });
      del.addEventListener('click', () => {
        this.presets = this.presets.filter((x) => x !== p);
        savePresets(store, this.presets);
        this.render();
      });
      presetList.append(h('li', {}, [load, del]));
    }

    this.renderBpm();
    this.renderPlay();
    this.tapBtn.textContent = t('metro.tap');
    this.el.replaceChildren(
      h('div', { class: 'metro-display card' }, [
        h('div', { class: 'bpm-row' }, [this.bpmBig, h('span', { class: 'bpm-unit', text: t('metro.bpm') })]),
        this.barLine,
        this.circles.el,
        h('p', { class: 'small', text: t('metro.circleHelp') }),
      ]),
      h('div', { class: 'tempo-controls card' }, [
        h('div', { class: 'row center' }, [this.stepButton(-1), this.bpmInput, this.stepButton(1)]),
        this.slider,
        h('div', { class: 'row center' }, [this.tapBtn, this.playBtn]),
        h('p', { class: 'small', text: t('metro.tapHelp') }),
      ]),
      h('details', { class: 'card', open: true }, [
        h('summary', { text: t('metro.rhythm') }),
        h('div', { class: 'grid2' }, [sigField, customField, subField, soundField]),
        m.signatureId === '6/8' || m.signatureId === '12/8' || m.signatureId === '7/8' ? h('p', { class: 'small', text: t('metro.compoundHelp') }) : null,
      ]),
      h('details', { class: 'card' }, [
        h('summary', { text: t('metro.volumes') }),
        this.range(t('metro.volAccent'), m.volumes.accent, (v) => ((m.volumes.accent = v), this.changed())),
        this.range(t('metro.volBeat'), m.volumes.beat, (v) => ((m.volumes.beat = v), this.changed())),
        this.range(t('metro.volSub'), m.volumes.sub, (v) => ((m.volumes.sub = v), this.changed())),
        this.check(t('settings.vibrate'), this.ctx.settings.vibrate, (v) => ((this.ctx.settings.vibrate = v), this.changed())),
      ]),
      h('details', { class: 'card' }, [
        h('summary', { text: t('training.title') }),
        this.select<number>(t('training.countIn'), m.countIn, [0, 1, 2].map((v) => ({ v, label: t(`training.countIn${v}`) })), (v) => ((m.countIn = v as 0 | 1 | 2), this.changed())),
        this.check(t('training.accel'), m.accel.enabled, (v) => ((m.accel.enabled = v), this.changed())),
        h('div', { class: 'grid3' }, [
          this.number(t('training.accelStep'), m.accel.stepBpm, 1, 50, (v) => ((m.accel.stepBpm = v), this.changed())),
          this.number(t('training.accelEvery'), m.accel.everyBars, 1, 64, (v) => ((m.accel.everyBars = v), this.changed())),
          this.number(t('training.accelTarget'), m.accel.targetBpm, MIN_BPM, MAX_BPM, (v) => ((m.accel.targetBpm = v), this.changed())),
        ]),
        this.check(t('training.silent'), m.silent.enabled, (v) => ((m.silent.enabled = v), this.changed())),
        h('div', { class: 'grid2' }, [
          this.number(t('training.silentPlay'), m.silent.playBars, 1, 32, (v) => ((m.silent.playBars = v), this.changed())),
          this.number(t('training.silentMute'), m.silent.muteBars, 1, 32, (v) => ((m.silent.muteBars = v), this.changed())),
        ]),
      ]),
      h('details', { class: 'card' }, [h('summary', { text: t('presets.title') }), presetList, h('div', { class: 'row' }, [presetName, saveBtn])]),
    );
    this.compact.replaceChildren(this.miniPlay, this.bpmMini, this.miniCircles.el);
  }
}
