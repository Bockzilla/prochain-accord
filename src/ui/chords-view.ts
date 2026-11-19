import { TestSignal } from '../audio/test-signal';
import type { DetectorResult } from '../detection/detector';
import { getLocale, t } from '../i18n/i18n';
import { pcName, romanPretty, spellingForRoman } from '../i18n/notation';
import { GUITAR } from '../instruments/model';
import { chordPositions } from '../instruments/positions';
import { soundingMidi } from '../instruments/validate';
import { ChromaBars } from '../render/chroma-bars';
import { h } from '../render/dom';
import { suggestNext, type SuggestResult } from '../suggestions/rank';
import { ALL_QUALITIES, BASIC_QUALITIES, chord, chordId, chordPitchClasses, sameChord, type Chord } from '../theory/chords';
import { keySpelling, type Key } from '../theory/keys';
import { analyzeProgression } from '../theory/harmony';
import { chordDiagram } from './diagram';
import { nameOf, type AppContext } from './context';

interface HistoryItem {
  chord: Chord;
  bar: number | null;
}

const CATEGORY_ICON = { safe: '●', colorful: '◆', bold: '▲' } as const;

export class ChordsView {
  readonly el: HTMLElement;
  private history: HistoryItem[] = [];
  private shown: Chord | null = null;
  private last: Chord | null = null;
  private preview: Chord | null = null;
  private posIndex = 0;
  private suggest: SuggestResult | null = null;
  private testSignal: TestSignal;
  private chroma: ChromaBars;
  // Éléments mis à jour souvent
  private bigName = h('div', { class: 'chord-big', 'aria-live': 'polite' });
  private lastName = h('div', { class: 'chord-last' });
  private confBar = h('div', { class: 'conf-fill' });
  private confText = h('span', { class: 'conf-text' });
  private keyLine = h('div', { class: 'key-line' });
  private diagramBox = h('div', { class: 'diagram-box' });
  private suggestionsBox = h('div', { class: 'suggestions' });
  private historyBox = h('ol', { class: 'history' });
  private micButton = h('button', { type: 'button', class: 'mic-btn primary' });
  private micStatus = h('p', { class: 'mic-status', role: 'status' });
  private hint = h('p', { class: 'hint' });
  private debugBox = h('section', { class: 'debug card' });
  private debugText = h('pre', { class: 'debug-text' });

  constructor(private ctx: AppContext) {
    this.testSignal = new TestSignal(ctx.engine);
    this.chroma = new ChromaBars([]);
    this.el = h('section', { id: 'chords-panel', class: 'chords-panel' });
    this.micButton.addEventListener('click', () => void this.toggleMic());
    this.render();
  }

  /** Reconstruit toute la vue (changement de langue, d'instrument…). */
  render(): void {
    const c = this.ctx;
    this.posIndex = 0; // changement d'instrument : on repart de la première position
    this.chroma.setLabels(Array.from({ length: 12 }, (_, i) => pcName(i, c.settings.notation, getLocale())));
    this.el.replaceChildren(
      h('div', { class: 'mic-row' }, [this.micButton, this.micStatus]),
      h('div', { class: 'now card' }, [
        this.bigName,
        this.lastName,
        h('div', { class: 'conf', 'aria-hidden': 'true' }, [h('div', { class: 'conf-track' }, [this.confBar]), this.confText]),
        this.keyLine,
        this.echoNote,
      ]),
      this.hint,
      this.pauseNote,
      h('div', { class: 'diagram-card card' }, [this.diagramBox]),
      h('h2', { text: t('suggestions.title') }),
      this.suggestionsBox,
      h('h2', { text: t('history.title') }),
      this.historyBox,
      this.debugBox,
    );
    this.pauseNote.textContent = t('play.speakerNotice');
    this.echoNote.textContent = t('play.echo');
    this.renderMic();
    this.renderNow();
    this.renderDiagram();
    this.renderSuggestions();
    this.renderHistory();
    this.renderDebugPanel();
    this.renderHint();
  }

  private renderMic(): void {
    const on = this.ctx.engine.micActive;
    this.micButton.textContent = on ? t('mic.stop') : t('mic.start');
    this.micButton.setAttribute('aria-pressed', String(on));
    if (!on && !this.micStatus.dataset.error) this.micStatus.textContent = t('mic.privacy');
  }

  /** Ouvre / ferme le micro (partagé par tous les espaces). `want` force l'état voulu. */
  async toggleMic(want?: boolean): Promise<boolean> {
    const e = this.ctx.engine;
    delete this.micStatus.dataset.error;
    const target = want ?? !e.micActive;
    if (!target && e.micActive) {
      e.stopMic();
    } else if (target && !e.micActive) {
      try {
        this.micStatus.textContent = t('mic.asking');
        e.setChannel(this.ctx.settings.inputChannel);
        e.echoCancellation = this.ctx.settings.echoCancellation;
        await e.startMic(this.ctx.settings.inputDeviceId);
        this.micStatus.textContent = t('mic.listening');
      } catch (err) {
        const name = (err as DOMException)?.name;
        this.micStatus.dataset.error = '1';
        this.micStatus.textContent = name === 'NotAllowedError' ? t('mic.denied') : !window.isSecureContext ? t('mic.https') : t('mic.error');
      }
    }
    this.ctx.settings.micWanted = e.micActive;
    this.renderMic();
    this.renderHint();
    this.ctx.commit();
    this.onMicChange?.();
    return e.micActive;
  }

  onMicChange: (() => void) | null = null;
  /** Nouvel accord validé (pour le monde harmonique). */
  onChordPlayed: ((c: Chord) => void) | null = null;

  renderHint(): void {
    const show = this.ctx.metro.running && this.ctx.engine.micActive;
    this.hint.textContent = show ? t('hint.wired') : '';
    this.hint.hidden = !show;
  }

  private displayedChord(): Chord | null {
    return this.preview ?? this.shown ?? this.last;
  }

  private renderNow(): void {
    const c = this.shown;
    const key = this.suggest?.key ?? null;
    this.bigName.textContent = c ? nameOf(this.ctx, c, key) : '…';
    this.bigName.classList.toggle('waiting', !c);
    this.lastName.textContent = !c && this.last ? t('now.last', { chord: nameOf(this.ctx, this.last, key) }) : this.preview ? t('now.preview', { chord: nameOf(this.ctx, this.preview, key) }) : '';
    if (this.suggest) {
      const keyName = (k: Key) => `${pcName(k.tonic, this.ctx.settings.notation, getLocale(), keySpelling(k))} ${t(k.mode === 'major' ? 'key.major' : 'key.minor')}`;
      // Même analyse prudente que « Comprendre » : une tonalité ambiguë n'est jamais affichée comme sûre.
      const a = this.history.length >= 2 ? analyzeProgression(this.history.map((x) => x.chord)) : null;
      if (a?.relativeAmbiguity) {
        this.keyLine.textContent = t('key.ambiguous', { a: keyName(a.candidates[0]!.key), b: keyName(a.candidates[1]!.key) });
      } else if (a) {
        this.keyLine.textContent = t(a.certainty === 'high' ? 'key.estimated' : 'key.estimatedUnsure', { key: keyName(a.best) });
      } else {
        this.keyLine.textContent = t('key.estimatedUnsure', { key: keyName(this.suggest.key) });
      }
    } else {
      this.keyLine.textContent = t('key.none');
    }
  }

  private renderDiagram(): void {
    const c = this.displayedChord();
    if (!c) {
      this.diagramBox.replaceChildren(h('p', { class: 'placeholder', text: t('diagram.empty') }));
      return;
    }
    const d = chordDiagram(this.ctx, c, this.posIndex, false);
    this.posIndex = d.index;
    const prev = h('button', { type: 'button', class: 'nav', 'aria-label': t('diagram.prev'), text: '◀', disabled: d.count < 2 });
    const next = h('button', { type: 'button', class: 'nav', 'aria-label': t('diagram.next'), text: '▶', disabled: d.count < 2 });
    prev.addEventListener('click', () => {
      this.posIndex--;
      this.renderDiagram();
    });
    next.addEventListener('click', () => {
      this.posIndex++;
      this.renderDiagram();
    });
    const caption = h('p', { class: 'caption' }, [
      h('strong', { text: nameOf(this.ctx, c, this.suggest?.key ?? null) }),
      ` · ${t('diagram.position', { i: d.index + 1, n: d.count })} · ${d.caption}`,
    ]);
    const actions: (HTMLElement | null)[] = [];
    if (this.preview) {
      const back = h('button', { type: 'button', class: 'link', text: t('diagram.back') });
      back.addEventListener('click', () => {
        this.preview = null;
        this.posIndex = 0;
        this.renderNow();
        this.renderDiagram();
      });
      actions.push(back);
    }
    this.diagramBox.replaceChildren(h('div', { class: 'diagram-row' }, [prev, d.el, next]), caption, h('p', { class: 'tap-hint', text: t('diagram.tapToHear') }), ...actions.filter(Boolean) as HTMLElement[]);
  }

  private renderSuggestions(): void {
    const s = this.suggest;
    if (!s) {
      this.suggestionsBox.replaceChildren(h('p', { class: 'placeholder', text: t('suggestions.empty') }));
      return;
    }
    this.suggestionsBox.replaceChildren(
      ...s.suggestions.map((sg) => {
        const d = chordDiagram(this.ctx, sg.chord, 0, true);
        const reason = t(`reason.${sg.reason}`, { target: sg.reasonTarget ? romanPretty(sg.reasonTarget) : '' });
        const card = h('article', { class: `sugg ${sg.category}` }, [
          h('header', {}, [
            h('span', { class: 'sugg-name', text: nameOf(this.ctx, sg.chord, s.key, spellingForRoman(sg.roman, s.key)) }),
            h('span', { class: 'sugg-roman', text: romanPretty(sg.roman) }),
          ]),
          h('p', { class: 'sugg-cat' }, [h('span', { class: 'cat-icon', 'aria-hidden': 'true', text: CATEGORY_ICON[sg.category] }), ` ${t(`category.${sg.category}`)}`]),
          d.el,
          h('p', { class: 'sugg-reason', text: reason }),
        ]);
        const show = h('button', { type: 'button', class: 'link', text: t('suggestions.show') });
        show.addEventListener('click', () => {
          this.preview = sg.chord;
          this.posIndex = 0;
          this.renderNow();
          this.renderDiagram();
          this.diagramBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        card.append(show);
        return card;
      }),
    );
  }

  private renderHistory(): void {
    if (this.history.length === 0) {
      this.historyBox.replaceChildren(h('li', { class: 'placeholder', text: t('history.empty') }));
      return;
    }
    const key = this.suggest?.key ?? null;
    this.historyBox.replaceChildren(
      ...this.history
        .slice(-12)
        .reverse()
        .map((it) => h('li', { text: it.bar !== null && this.ctx.settings.alignHistory ? t('history.bar', { n: it.bar + 1, chord: nameOf(this.ctx, it.chord, key) }) : nameOf(this.ctx, it.chord, key) })),
    );
    const clear = h('li', {}, [h('button', { type: 'button', class: 'link', text: t('history.clear') })]);
    clear.firstElementChild!.addEventListener('click', () => {
      this.history = [];
      this.suggest = null;
      this.onKeyChange?.(null, 0, []);
      this.ctx.detector.stabilizer.reset();
      this.shown = this.last = this.preview = null;
      this.render();
    });
    this.historyBox.append(clear);
  }

  private updateSuggestions(): void {
    const chords = this.history.map((x) => x.chord);
    this.suggest = suggestNext(chords, { count: 6, sevenths: this.ctx.settings.extended });
    const a = chords.length >= 2 ? analyzeProgression(chords) : null;
    const conf = !a ? 0 : a.relativeAmbiguity ? 0.3 : a.certainty === 'high' ? 1 : a.certainty === 'medium' ? 0.6 : 0.3;
    this.onKeyChange?.(a ? a.best : null, conf, chords);
  }

  /** Prévient les autres espaces (tonalité estimée, accords joués). */
  onKeyChange: ((key: Key | null, confidence: number, played: Chord[]) => void) | null = null;

  /** Accompagnement sur haut-parleur : message explicite (la détection continue, avec prudence). */
  setSpeakerNotice(on: boolean): void {
    this.pauseNote.hidden = !on;
  }
  private pauseNote = h('p', { class: 'hint', hidden: true });
  private echoNote = h('p', { class: 'echo-note', hidden: true });

  /**
   * Appelé par la boucle de détection. `bandChord` : accord joué par l'accompagnement
   * quand il sort sur le haut-parleur (le micro peut l'entendre).
   */
  onDetection(r: DetectorResult, bandChord: Chord | null = null): void {
    // Haut-parleur : un accord identique à celui de l'accompagnement est probablement… l'accompagnement.
    const echo = !!bandChord && !!r.state.current && sameChord(r.state.current, bandChord);
    this.echoNote.hidden = !echo;
    const a = r.analysis;
    if (a) {
      const pct = Math.round(a.confidence * 100);
      this.confBar.style.width = `${pct}%`;
      this.confText.textContent = a.gateOpen ? t('now.confidence', { n: pct }) : t('now.silence');
    }
    const changedShown = !sameChord(r.state.current, this.shown) || (r.state.current === null) !== (this.shown === null);
    if (r.state.changed && r.state.current && !echo) {
      this.onChordPlayed?.(r.state.current);
      const lastHist = this.history[this.history.length - 1];
      if (!lastHist || !sameChord(lastHist.chord, r.state.current)) {
        const m = this.ctx.metro;
        const bar = m.running && m.lastShown && m.lastShown.bar >= 0 ? m.lastShown.bar : null;
        this.history.push({ chord: r.state.current, bar });
        if (this.history.length > 32) this.history.shift();
        this.updateSuggestions();
        this.preview = null;
        this.posIndex = 0;
        this.renderSuggestions();
        this.renderHistory();
      }
    }
    if (changedShown || r.state.changed) {
      this.shown = r.state.current;
      this.last = r.state.last;
      this.renderNow();
      if (r.state.changed) this.renderDiagram();
    }
    if (this.ctx.settings.debug && a) {
      const hl = new Set(a.matches[0] ? chordPitchClasses(a.matches[0].chord) : []);
      this.chroma.update(a.chroma, hl);
      const top = a.matches
        .slice(0, 3)
        .map((m) => `${nameOf(this.ctx, m.chord).padEnd(7)} ${m.score.toFixed(3)}`)
        .join('\n');
      this.debugText.textContent = [
        `${t('debug.rms')}: ${a.rms.toFixed(4)}  ${t('debug.gate')}: ${a.gateOpen ? t('debug.open') : t('debug.closed')}`,
        `${t('debug.confidence')}: ${a.confidence.toFixed(2)}  ${t('debug.bass')}: ${a.bass >= 0 ? pcName(a.bass, this.ctx.settings.notation, getLocale()) : '—'}`,
        `${t('debug.clickAvoided')}: ${r.avoidedClick ? t('debug.yes') : t('debug.no')}${this.ctx.engine.usingFallback ? `  (${t('debug.fallback')})` : ''}`,
        top,
      ].join('\n');
    }
  }

  private renderDebugPanel(): void {
    this.debugBox.hidden = !this.ctx.settings.debug;
    if (!this.ctx.settings.debug) {
      this.testSignal.stop();
      return;
    }
    const select = h('select', { 'aria-label': t('debug.testChord') });
    const choices: Chord[] = [];
    for (const q of this.ctx.settings.extended ? ALL_QUALITIES : BASIC_QUALITIES) for (let r = 0; r < 12; r++) choices.push(chord(r, q));
    for (const c of choices) select.append(h('option', { value: chordId(c), text: nameOf(this.ctx, c) }));
    const audible = h('input', { type: 'checkbox', id: 'dbg-audible' });
    const play = h('button', { type: 'button', text: t('debug.playTest') });
    const stop = h('button', { type: 'button', text: t('debug.stopTest') });
    play.addEventListener('click', () => {
      const c = choices.find((x) => chordId(x) === select.value)!;
      const midi = soundingMidi(GUITAR, chordPositions(GUITAR, c)[0]!.frets);
      void this.testSignal.play(midi, audible.checked);
    });
    stop.addEventListener('click', () => this.testSignal.stop());
    this.debugBox.replaceChildren(
      h('h2', { text: t('debug.title') }),
      this.chroma.el,
      this.debugText,
      h('div', { class: 'row' }, [select, play, stop]),
      h('label', { class: 'row' }, [audible, ` ${t('debug.audible')}`]),
      h('p', { class: 'small', text: t('debug.testExplain') }),
    );
  }

  get analysisActive(): boolean {
    return this.ctx.engine.micActive || this.testSignal.playing;
  }
}
