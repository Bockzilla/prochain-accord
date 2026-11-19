import { AudioEngine } from '../audio/engine';
import { ChordDetector } from '../detection/detector';
import { LOCALES, setLocale, t, type Locale } from '../i18n/i18n';
import type { Notation } from '../i18n/notation';
import type { InstrumentId } from '../instruments/model';
import { h } from '../render/dom';
import { ALL_QUALITIES, BASIC_QUALITIES } from '../theory/chords';
import { ChordsView } from './chords-view';
import type { AppContext } from './context';
import { MetronomeController } from './metronome-controller';
import { MetronomeView } from './metronome-view';
import { loadSettings, noiseGateFor, saveSettings } from './settings';
import { WakeLockManager } from './wake-lock';

export function startApp(root: HTMLElement): void {
  const settings = loadSettings(navigator.languages ?? [navigator.language]);
  setLocale(settings.locale);
  const engine = new AudioEngine();
  const detector = new ChordDetector(engine.sampleRate);
  detector.gate.opts = { before: 0.02, after: 0.06, fade: 0.004 };
  const metro = new MetronomeController(engine);
  metro.onClickAtMic = (time) => detector.gate.add(time);
  const wake = new WakeLockManager();

  let chordsView: ChordsView;
  let metroView: MetronomeView;
  let activeTab: 'chords' | 'metronome' = 'chords';

  const applyDetection = () => {
    detector.options = {
      ...detector.options,
      qualities: settings.extended ? ALL_QUALITIES : BASIC_QUALITIES,
      noiseGate: noiseGateFor(settings.sensitivity),
      chroma: { ...detector.options.chroma, a4: settings.a4 },
    };
  };

  const ctx: AppContext = {
    settings,
    engine,
    metro,
    detector,
    commit(opts) {
      saveSettings(settings);
      // Mode débogage : relevé des clics consultable dans la console (window.__prochainAccordDebug).
      metro.debugLog = settings.debug ? metro.debugLog ?? [] : null;
      (window as unknown as Record<string, unknown>).__prochainAccordDebug = settings.debug ? { clicks: () => metro.debugLog, audioTime: () => engine.ctx.currentTime } : undefined;
      applyDetection();
      wake.want(settings.wakeLock && (engine.micActive || metro.running));
      if (opts?.rerender) renderAll();
    },
  };

  applyDetection();
  metro.apply(settings);
  chordsView = new ChordsView(ctx);
  metroView = new MetronomeView(ctx);
  metro.onState(() => {
    chordsView.renderHint();
    ctx.commit();
  });

  // --- Structure de la page ---
  const title = h('h1', { class: 'app-title' });
  const tabChords = h('button', { type: 'button', role: 'tab', id: 'tab-chords', 'aria-controls': 'view-chords' });
  const tabMetro = h('button', { type: 'button', role: 'tab', id: 'tab-metronome', 'aria-controls': 'view-metronome' });
  const settingsBtn = h('button', { type: 'button', class: 'icon settings-btn', text: '⚙' });
  const dialog = h('dialog', { class: 'settings' });
  const main = h('main');
  const footer = h('footer', { class: 'compact-bar' });
  root.replaceChildren(h('header', { class: 'topbar' }, [title, h('nav', { role: 'tablist' }, [tabChords, tabMetro]), settingsBtn]), main, footer, dialog);

  const showTab = (tab: typeof activeTab) => {
    activeTab = tab;
    tabChords.setAttribute('aria-selected', String(tab === 'chords'));
    tabMetro.setAttribute('aria-selected', String(tab === 'metronome'));
    chordsView.el.hidden = tab !== 'chords';
    metroView.el.hidden = tab !== 'metronome';
    footer.hidden = tab !== 'chords';
  };
  tabChords.addEventListener('click', () => showTab('chords'));
  tabMetro.addEventListener('click', () => showTab('metronome'));
  settingsBtn.addEventListener('click', () => {
    renderSettings();
    dialog.showModal();
  });

  function renderAll(): void {
    setLocale(settings.locale);
    document.title = t('app.title');
    title.textContent = t('app.title');
    tabChords.textContent = t('tab.chords');
    tabMetro.textContent = t('tab.metronome');
    settingsBtn.setAttribute('aria-label', t('settings.title'));
    chordsView.render();
    metroView.render();
    main.replaceChildren(chordsView.el, metroView.el);
    footer.replaceChildren(metroView.compact);
    showTab(activeTab);
  }

  function renderSettings(): void {
    const s = settings;
    const field = (label: string, input: HTMLElement) => h('label', { class: 'field' }, [h('span', { text: label }), input]);
    const select = <T extends string | number>(value: T, opts: { v: T; label: string }[], onChange: (v: T) => void) => {
      const sel = h('select');
      for (const o of opts) sel.append(h('option', { value: String(o.v), text: o.label, selected: o.v === value }));
      sel.addEventListener('change', () => onChange((typeof value === 'number' ? Number(sel.value) : sel.value) as T));
      return sel;
    };
    const check = (label: string, value: boolean, onChange: (v: boolean) => void) => {
      const inp = h('input', { type: 'checkbox', checked: value });
      inp.addEventListener('change', () => onChange(inp.checked));
      return h('label', { class: 'check' }, [inp, h('span', { text: label })]);
    };
    const num = (value: number, min: number, max: number, step: number, onChange: (v: number) => void) => {
      const inp = h('input', { type: 'number', min, max, step, value, inputmode: 'numeric' });
      inp.addEventListener('change', () => {
        const v = Math.max(min, Math.min(max, Number(inp.value) || 0));
        inp.value = String(v);
        onChange(v);
      });
      return inp;
    };
    const sens = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.sensitivity });
    sens.addEventListener('input', () => {
      s.sensitivity = Number(sens.value);
      ctx.commit();
    });
    const rerender = () => {
      ctx.commit({ rerender: true });
      renderSettings();
    };
    const close = h('button', { type: 'button', class: 'primary', text: t('settings.close') });
    close.addEventListener('click', () => dialog.close());
    dialog.replaceChildren(
      h('h2', { text: t('settings.title') }),
      field(t('settings.instrument'), select<InstrumentId>(s.instrument, (['guitar', 'mandolin', 'piano'] as InstrumentId[]).map((v) => ({ v, label: t(`instrument.${v}`) })), (v) => ((s.instrument = v), rerender()))),
      h('p', { class: 'small', text: t('settings.instrumentHelp') }),
      field(t('settings.language'), select<Locale>(s.locale, LOCALES.map((v) => ({ v, label: t(`lang.${v}`) })), (v) => ((s.locale = v), rerender()))),
      field(t('settings.notation'), select<Notation>(s.notation, [{ v: 'anglo', label: t('notation.anglo') }, { v: 'latin', label: t('notation.latin') }], (v) => ((s.notation = v), rerender()))),
      check(t('settings.lefty'), s.lefty, (v) => ((s.lefty = v), rerender())),
      field(t('settings.playStyle'), select<'strum' | 'block'>(s.playStyle, [{ v: 'strum', label: t('playStyle.strum') }, { v: 'block', label: t('playStyle.block') }], (v) => ((s.playStyle = v), ctx.commit()))),
      check(t('settings.extended'), s.extended, (v) => ((s.extended = v), rerender())),
      field(t('settings.sensitivity'), sens),
      field(t('settings.a4'), num(s.a4, 415, 466, 1, (v) => ((s.a4 = v), ctx.commit()))),
      field(t('settings.latency'), num(s.latencyMs, -100, 500, 5, (v) => ((s.latencyMs = v), metro.apply(s), ctx.commit()))),
      h('p', { class: 'small', text: t('settings.latencyHelp') }),
      check(t('settings.alignHistory'), s.alignHistory, (v) => ((s.alignHistory = v), rerender())),
      check(t('settings.wakeLock'), s.wakeLock, (v) => ((s.wakeLock = v), ctx.commit())),
      check(t('settings.debug'), s.debug, (v) => ((s.debug = v), rerender())),
      h('p', { class: 'small', text: t('settings.privacy') }),
      close,
    );
  }

  renderAll();

  // --- Boucle de détection (interface ; ne touche pas à l'horloge du métronome) ---
  setInterval(() => {
    if (!chordsView.analysisActive) return;
    engine.pollFallback();
    chordsView.onDetection(detector.step(engine.ring, performance.now()));
  }, 50);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ctx.commit();
  });
}
