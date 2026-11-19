import { AudioEngine } from '../audio/engine';
import { TestSignal } from '../audio/test-signal';
import { ChordDetector } from '../detection/detector';
import { PROFILE_IDS, PROFILES, type ProfileId } from '../detection/profiles';
import { LOCALES, setLocale, t, type Locale } from '../i18n/i18n';
import type { Notation } from '../i18n/notation';
import type { InstrumentId } from '../instruments/model';
import { h } from '../render/dom';
import { ALL_QUALITIES, BASIC_QUALITIES } from '../theory/chords';
import { runCalibration } from './calibration-dialog';
import { PlayView } from './play-view';
import { TunerView } from './tuner-view';
import { AccompanimentController } from './accompaniment-controller';
import { AccompanyView } from './accompany-view';
import { ChordsView } from './chords-view';
import type { AppContext } from './context';
import { HarmonyView } from './harmony-view';
import { ImproviseView } from './improvise-view';
import { MetronomeController } from './metronome-controller';
import { MetronomeView } from './metronome-view';
import { loadSettings, noiseGateFor, saveSettings, type Space } from './settings';
import { SharedMusic } from './shared';
import { WakeLockManager } from './wake-lock';

const SPACES: { id: Space; icon: string }[] = [
  { id: 'play', icon: '🎸' },
  { id: 'improvise', icon: '🎼' },
  { id: 'accompany', icon: '🥁' },
  { id: 'understand', icon: '🧭' },
];

export function startApp(root: HTMLElement): void {
  const settings = loadSettings(navigator.languages ?? [navigator.language]);
  setLocale(settings.locale);
  const engine = new AudioEngine();
  const detector = new ChordDetector(engine.sampleRate);
  detector.gate.opts = { before: 0.02, after: 0.06, fade: 0.004 };
  const metro = new MetronomeController(engine);
  metro.onClickAtMic = (time) => detector.gate.add(time);
  const wake = new WakeLockManager();
  const shared = new SharedMusic(settings);
  const debugSignal = new TestSignal(engine);

  const applyDetection = () => {
    if (detector.profile.id !== settings.profile) detector.applyProfile(PROFILES[settings.profile] ?? PROFILES.balanced);
    detector.manualGate = noiseGateFor(settings.sensitivity);
    detector.adaptive = settings.adaptive;
    detector.options = {
      ...detector.options,
      qualities: settings.extended ? ALL_QUALITIES : BASIC_QUALITIES,
      chroma: { ...detector.options.chroma, a4: settings.a4 },
    };
  };

  let acc: AccompanimentController;
  const ctx: AppContext = {
    settings,
    engine,
    metro,
    detector,
    commit(opts) {
      saveSettings(settings);
      // Mode débogage : relevé des clics consultable dans la console (window.__prochainAccordDebug).
      metro.debugLog = settings.debug ? metro.debugLog ?? [] : null;
      (window as unknown as Record<string, unknown>).__prochainAccordDebug = settings.debug
        ? {
            clicks: () => metro.debugLog,
            audioTime: () => engine.ctx.currentTime,
            band: () => acc?.band.activeSources,
            // Note de test envoyée dans la chaîne d'analyse (accordeur, détection de notes), sans guitare.
            testNote: (midi: number, cents = 0) => debugSignal.playNote(midi, cents, false),
            testChord: (midis: number[]) => debugSignal.play(midis, false),
            stopTest: () => debugSignal.stop(),
          }
        : undefined;
      applyDetection();
      wake.want(settings.wakeLock && (engine.micActive || metro.running));
      if (opts?.rerender) renderAll();
    },
  };

  applyDetection();
  metro.apply(settings);
  acc = new AccompanimentController(engine, metro, settings, shared);
  const chordsView = new ChordsView(ctx);
  chordsView.onKeyChange = (key, conf, played) => shared.setDetected(key, conf, played);
  const ensureMic = async () => engine.micActive || (await chordsView.toggleMic(true));
  const tunerView = new TunerView(ctx, () => void chordsView.toggleMic(true));
  const playView = new PlayView(ctx, chordsView, tunerView);
  const metroView = new MetronomeView(ctx);
  const improviseView = new ImproviseView(ctx, shared);
  const accompanyView = new AccompanyView(ctx, shared, acc, metroView);
  const harmonyView = new HarmonyView(ctx, shared, {
    showScale: (s) => {
      improviseView.show(s);
      showSpace('improvise');
    },
    playProgression: (style, id, key) => {
      Object.assign(settings.music, { style, progressionId: id, accompanySection: 'loops' });
      shared.setManualKey(key);
      ctx.commit();
      showSpace('accompany');
      void acc.play();
    },
  });
  shared.on(() => ctx.commit());
  metro.onState(() => {
    chordsView.renderHint();
    ctx.commit();
  });

  // --- Structure de la page ---
  const title = h('h1', { class: 'app-title' });
  const tabs = SPACES.map((sp) => h('button', { type: 'button', role: 'tab', id: `tab-${sp.id}`, 'aria-controls': `view-${sp.id}` }));
  const settingsBtn = h('button', { type: 'button', class: 'icon settings-btn', text: '⚙' });
  const micBtn = h('button', { type: 'button', class: 'icon mic-global', text: '🎤' });
  micBtn.addEventListener('click', () => void chordsView.toggleMic());
  const renderMicBtn = () => {
    micBtn.classList.toggle('on', engine.micActive);
    micBtn.setAttribute('aria-pressed', String(engine.micActive));
    micBtn.setAttribute('aria-label', engine.micActive ? t('mic.stop') : t('mic.start'));
  };
  chordsView.onMicChange = () => {
    renderMicBtn();
    tunerView.render();
  };
  const dialog = h('dialog', { class: 'settings' });
  const main = h('main');
  const footer = h('footer', { class: 'compact-bar' });
  root.replaceChildren(h('header', { class: 'topbar' }, [h('div', { class: 'title-row' }, [title, h('div', { class: 'row tight' }, [micBtn, settingsBtn])]), h('nav', { role: 'tablist', class: 'spaces' }, tabs)]), main, footer, dialog);

  const views: Record<Space, { el: HTMLElement; render(): void }> = { play: playView, improvise: improviseView, accompany: accompanyView, understand: harmonyView };

  function showSpace(sp: Space): void {
    settings.space = sp;
    SPACES.forEach((s, i) => tabs[i]!.setAttribute('aria-selected', String(s.id === sp)));
    for (const s of SPACES) views[s.id].el.hidden = s.id !== sp;
    if (sp !== 'play') views[sp].render();
    playView.syncActive();
    // La barre compacte (métronome) reste disponible partout sauf dans « Accompagner », qui a ses commandes.
    footer.hidden = sp === 'accompany';
    saveSettings(settings);
    window.scrollTo({ top: 0 });
  }
  SPACES.forEach((s, i) => tabs[i]!.addEventListener('click', () => showSpace(s.id)));
  settingsBtn.addEventListener('click', () => {
    void renderSettings();
    dialog.showModal();
  });

  function renderAll(): void {
    setLocale(settings.locale);
    document.title = t('app.title');
    title.textContent = t('app.title');
    SPACES.forEach((s, i) => {
      tabs[i]!.replaceChildren(h('span', { class: 'tab-icon', 'aria-hidden': 'true', text: s.icon }), h('span', { class: 'tab-label', text: t(`space.${s.id}`) }));
    });
    settingsBtn.setAttribute('aria-label', t('settings.title'));
    renderMicBtn();
    playView.render();
    metroView.render();
    main.replaceChildren(playView.el, improviseView.el, accompanyView.el, harmonyView.el);
    footer.replaceChildren(metroView.compact);
    showSpace(settings.space);
  }

  async function renderSettings(): Promise<void> {
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
      void renderSettings();
    };
    // Entrées audio (noms visibles une fois le micro autorisé)
    const inputs = await engine.listInputs().catch(() => []);
    const inputOpts = [{ v: '', label: t('settings.inputDefault') }, ...inputs.filter((d) => d.id && d.id !== 'default').map((d, i) => ({ v: d.id, label: d.label || t('settings.inputN', { n: i + 1 }) }))];
    const inputSel = select<string>(s.inputDeviceId, inputOpts, (v) => {
      s.inputDeviceId = v;
      ctx.commit();
      if (engine.micActive) {
        engine.stopMic();
        void chordsView.toggleMic(true);
      }
    });
    const close = h('button', { type: 'button', class: 'primary', text: t('settings.close') });
    close.addEventListener('click', () => dialog.close());
    const calibBtn = h('button', { type: 'button', text: `🎯 ${t('calib.open')}` });
    calibBtn.addEventListener('click', () => void runCalibration(ctx, dialog, ensureMic));
    dialog.replaceChildren(
      h('h2', { text: t('settings.title') }),
      field(t('settings.instrument'), select<InstrumentId>(s.instrument, (['guitar', 'mandolin', 'piano'] as InstrumentId[]).map((v) => ({ v, label: t(`instrument.${v}`) })), (v) => ((s.instrument = v), rerender()))),
      h('p', { class: 'small', text: t('settings.instrumentHelp') }),
      field(t('settings.language'), select<Locale>(s.locale, LOCALES.map((v) => ({ v, label: t(`lang.${v}`) })), (v) => ((s.locale = v), rerender()))),
      field(t('settings.notation'), select<Notation>(s.notation, [{ v: 'anglo', label: t('notation.anglo') }, { v: 'latin', label: t('notation.latin') }], (v) => ((s.notation = v), rerender()))),
      check(t('settings.lefty'), s.lefty, (v) => ((s.lefty = v), rerender())),
      field(t('settings.playStyle'), select<'strum' | 'block'>(s.playStyle, [{ v: 'strum', label: t('playStyle.strum') }, { v: 'block', label: t('playStyle.block') }], (v) => ((s.playStyle = v), ctx.commit()))),
      h('h3', { text: t('settings.listening') }),
      field(t('settings.input'), inputSel),
      h('p', { class: 'small', text: t('settings.inputHelp') }),
      field(t('settings.channel'), select<number>(s.inputChannel, [{ v: -1, label: t('settings.channelMix') }, { v: 0, label: t('settings.channelN', { n: 1 }) }, { v: 1, label: t('settings.channelN', { n: 2 }) }], (v) => ((s.inputChannel = v as -1 | 0 | 1), engine.setChannel(s.inputChannel), ctx.commit()))),
      h('p', { class: 'small', text: engine.micActive ? t('settings.channelsSeen', { n: engine.inputChannels || 1 }) : t('settings.channelHelp') }),
      field(t('settings.profile'), select<ProfileId>(s.profile, PROFILE_IDS.map((v) => ({ v, label: t(`profile.${v}`) })), (v) => ((s.profile = v), ctx.commit(), void renderSettings()))),
      h('p', { class: 'small', text: t(`profileHelp.${s.profile}`) }),
      calibBtn,
      check(t('settings.adaptive'), s.adaptive, (v) => ((s.adaptive = v), ctx.commit())),
      h('p', { class: 'small', text: t('settings.adaptiveHelp') }),
      check(t('settings.echo'), s.echoCancellation, (v) => {
        s.echoCancellation = v;
        ctx.commit();
        if (engine.micActive) {
          engine.stopMic();
          void chordsView.toggleMic(true);
        }
      }),
      h('p', { class: 'small', text: t('settings.echoHelp') }),
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
  ctx.commit(); // installe aussi le crochet de débogage si le mode est actif

  // --- Boucle de détection (interface ; ne touche pas à l'horloge du métronome) ---
  // Casque ou interface audio : détection simultanée avec l'accompagnement.
  // Haut-parleur : la détection continue, mais un accord identique à celui de la boucle est signalé,
  // pas ajouté à l'historique (on ne prétend pas retirer la musique du micro).
  const detectLoop = () => {
    const bandPlaying = acc.state === 'playing';
    const speaker = bandPlaying && settings.music.output === 'speaker';
    chordsView.setSpeakerNotice(speaker && engine.micActive);
    if (chordsView.analysisActive) {
      engine.pollFallback();
      const bandChord = speaker && acc.currentIndex >= 0 ? acc.loop[acc.currentIndex] ?? null : null;
      chordsView.onDetection(detector.step(engine.ring, performance.now()), bandChord);
    }
    setTimeout(detectLoop, detector.profile.intervalMs);
  };
  detectLoop();

  // Micro voulu d'une session à l'autre : rouvert au premier geste (exigence des navigateurs).
  if (settings.micWanted) {
    const reopen = () => {
      window.removeEventListener('pointerdown', reopen);
      void chordsView.toggleMic(true);
    };
    window.addEventListener('pointerdown', reopen);
  }

  // Arrière-plan : l'accompagnement se met en pause (les minuteries du navigateur y sont bridées
  // et produiraient des trous) ; le métronome seul continue tant que la page reste active.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && acc.state === 'playing') acc.pause();
    if (document.visibilityState === 'visible') ctx.commit();
  });
}
