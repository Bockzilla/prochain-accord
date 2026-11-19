import { getLocale, t } from '../i18n/i18n';
import { parseProgression, pcName, romanPretty } from '../i18n/notation';
import { h, setChildren } from '../render/dom';
import { renderCircle } from '../render/circle-svg';
import type { Chord } from '../theory/chords';
import {
  analyzeProgression,
  diatonicTriads,
  progressionsFor,
  realizeProgression,
  STYLES,
  type HarmonicFunction,
  type ProgressionAnalysis,
  type Style,
} from '../theory/harmony';
import { keySpelling, type Key } from '../theory/keys';
import type { Scale } from '../theory/scales';
import { nameOf, type AppContext } from './context';
import { keyLabel } from './key-picker';
import type { SharedMusic } from './shared';

const FN_ICON: Record<HarmonicFunction, string> = { tonic: '⌂', subdominant: '↗', dominant: '⚡', outside: '?' };

export interface HarmonyActions {
  showScale(s: Scale): void;
  playProgression(style: Style, progressionId: string, key: Key): void;
}

/** Espace « Comprendre » : cercle des quintes, fonctions, progressions, analyse prudente. */
export class HarmonyView {
  readonly el: HTMLElement;
  private input = '';

  constructor(
    private ctx: AppContext,
    private shared: SharedMusic,
    private actions: HarmonyActions,
  ) {
    this.el = h('section', { id: 'view-understand', class: 'view', 'aria-labelledby': 'tab-understand' });
    shared.on(() => {
      if (!this.el.hidden) this.render();
    });
    this.render();
  }

  private chordName(c: Chord, key: Key): string {
    return nameOf(this.ctx, c, key);
  }

  render(): void {
    const key = this.shared.key;
    const pc = (p: number, k: Key) => pcName(p, this.ctx.settings.notation, getLocale(), keySpelling(k));
    const circle = renderCircle({
      selected: key,
      majorLabel: (tn) => pc(tn, { tonic: tn, mode: 'major' }),
      minorLabel: (tn) => `${pc(tn, { tonic: tn, mode: 'minor' })}m`,
      title: t('understand.circleTitle'),
      onSelect: (k) => {
        this.shared.setManualKey(k);
        this.ctx.commit();
      },
    });

    // Accords de la tonalité
    const table = h('div', { class: 'diatonic' });
    for (const d of diatonicTriads(key)) {
      table.append(
        h('div', { class: `dchord fn-${d.fn}` }, [
          h('span', { class: 'droman', text: romanPretty(d.roman) }),
          h('span', { class: 'dname', text: this.chordName(d.chord, key) }),
          h('span', { class: 'dfn' }, [h('span', { 'aria-hidden': 'true', text: FN_ICON[d.fn] }), ` ${t(`fn.${d.fn}`)}`]),
        ]),
      );
    }

    // Progressions par style
    const style = this.ctx.settings.music.style;
    const styleSel = h('select', { 'aria-label': t('accompany.style') });
    for (const st of STYLES) styleSel.append(h('option', { value: st, text: t(`style.${st}`), selected: st === style }));
    styleSel.addEventListener('change', () => {
      this.ctx.settings.music.style = styleSel.value as Style;
      this.ctx.commit();
      this.render();
    });
    const progList = h('ul', { class: 'prog-list' });
    for (const p of progressionsFor(style)) {
      // Même tonique quel que soit le mode : « La » donne un blues en La, en majeur comme en mineur.
      const r = realizeProgression(p, key.tonic);
      const names = r.chords.map((c) => this.chordName(c, r.key));
      const compact = names.filter((n, i) => i === 0 || n !== names[i - 1]).join(' – ');
      const analyze = h('button', { type: 'button', class: 'link', text: t('understand.analyze') });
      analyze.addEventListener('click', () => {
        this.input = names.join(' ');
        this.render();
        this.el.querySelector('.analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      const play = h('button', { type: 'button', class: 'link', text: t('understand.playIt') });
      play.addEventListener('click', () => this.actions.playProgression(style, p.id, r.key));
      progList.append(h('li', {}, [h('strong', { text: t(`prog.${p.id}`) }), h('span', { class: 'prog-chords', text: compact }), h('div', { class: 'row' }, [analyze, play])]));
    }

    // Analyse d'une progression
    const played = this.shared.played.slice(-8);
    const field = h('input', { type: 'text', value: this.input, placeholder: t('understand.inputPlaceholder'), 'aria-label': t('understand.inputLabel') });
    const go = h('button', { type: 'button', class: 'primary', text: t('understand.analyze') });
    go.addEventListener('click', () => {
      this.input = field.value;
      this.render();
    });
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.input = field.value;
        this.render();
      }
    });
    const usePlayed = h('button', { type: 'button', text: t('understand.usePlayed'), disabled: played.length === 0 });
    usePlayed.addEventListener('click', () => {
      this.input = played.map((c) => this.chordName(c, key)).join(' ');
      this.render();
    });

    const parsed = parseProgression(this.input);
    const analysis = parsed.chords.length ? analyzeProgression(parsed.chords) : null;

    setChildren(this.el, [
      h('div', { class: 'card' }, [
        h('h2', { text: t('understand.circle') }),
        h('div', { class: 'circle-wrap' }, [circle]),
        h('p', { class: 'key-now', text: t('understand.selected', { key: keyLabel(this.ctx, key) }) }),
        h('p', { class: 'small', text: t('understand.circleHelp') }),
      ]),
      h('div', { class: 'card' }, [
        h('h2', { text: t('understand.chordsOfKey', { key: keyLabel(this.ctx, key) }) }),
        table,
        h('p', { class: 'small', text: t('fn.explain') }),
        h('p', { class: 'small', text: t(key.mode === 'major' ? 'understand.majorExplain' : 'understand.minorExplain') }),
      ]),
      h('div', { class: 'card' }, [
        h('h2', { text: t('understand.progressions') }),
        h('label', { class: 'field' }, [h('span', { text: t('accompany.style') }), styleSel]),
        h('p', { class: 'small', text: t(`styleExplain.${style}`) }),
        progList,
      ]),
      h('div', { class: 'card analysis' }, [
        h('h2', { text: t('understand.analysisTitle') }),
        h('div', { class: 'row' }, [field, go]),
        usePlayed,
        parsed.invalid.length ? h('p', { class: 'warn', text: t('understand.invalid', { list: parsed.invalid.join(', ') }) }) : null,
        analysis ? this.analysisPanel(analysis) : h('p', { class: 'small', text: t('understand.analysisHelp') }),
      ]),
    ]);
  }

  private analysisPanel(a: ProgressionAnalysis): HTMLElement {
    const best = a.best;
    const pct = (x: number) => Math.round(x * 100);
    const [c1, c2] = a.candidates;
    const headline = a.relativeAmbiguity
      ? t('analysis.relative', { a: keyLabel(this.ctx, c1!.key), b: keyLabel(this.ctx, c2!.key) })
      : t(`analysis.certainty.${a.certainty}`, { key: keyLabel(this.ctx, best) });
    const scales = h('ul', { class: 'scale-list' });
    for (const s of a.scales) {
      const sp = keySpelling(best);
      const btn = h('button', { type: 'button', class: 'link', text: t('analysis.onNeck') });
      btn.addEventListener('click', () => this.actions.showScale(s.scale));
      scales.append(
        h('li', {}, [
          h('strong', { text: t('improvise.scaleName', { root: pcName(s.scale.tonic, this.ctx.settings.notation, getLocale(), sp), scale: t(`scale.${s.scale.type}`) }) }),
          h('span', { class: 'small', text: ` — ${t(`scaleReason.${s.reason}`)} (${t('analysis.coverage', { n: pct(s.coverage) })})` }),
          btn,
        ]),
      );
    }
    return h('div', { class: 'analysis-result' }, [
      h('p', { class: `headline cert-${a.relativeAmbiguity ? 'low' : a.certainty}`, text: headline }),
      h(
        'ul',
        { class: 'cands small' },
        a.candidates.map((c) => h('li', { text: t('analysis.candidate', { key: keyLabel(this.ctx, c.key), n: pct(c.likelihood) }) })),
      ),
      a.relativeAmbiguity ? h('p', { class: 'small', text: t('analysis.relativeExplain') }) : null,
      h('h3', { text: t('analysis.functions', { key: keyLabel(this.ctx, best) }) }),
      h(
        'ol',
        { class: 'fn-list' },
        a.chords.map((x) => h('li', { class: `fn-${x.fn}` }, [h('strong', { text: `${this.chordName(x.chord, best)} ` }), h('span', { text: `${romanPretty(x.roman)} · ${FN_ICON[x.fn]} ${t(`fn.${x.fn}`)} — ${t(`fnRole.${x.fn}`)}` })])),
      ),
      h('h3', { text: t('analysis.scales') }),
      scales,
    ]);
  }
}
