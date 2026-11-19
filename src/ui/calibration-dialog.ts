import { analyzeFrame } from '../detection/analyze';
import { analyzeCalibration, type CalibrationResult, type FrameMeasure } from '../detection/calibration';
import { rms } from '../detection/chroma';
import { PROFILES } from '../detection/profiles';
import { t } from '../i18n/i18n';
import { h, setChildren } from '../render/dom';
import type { AppContext } from './context';

const STEP_MS = { silence: 3000, chord: 4000 };

/**
 * Calibration guidée en 5 étapes réelles :
 * 1. silence mesuré, 2. accord mesuré, 3. analyse de la qualité, 4. recommandation, 5. application.
 */
export async function runCalibration(ctx: AppContext, dialog: HTMLDialogElement, ensureMic: () => Promise<boolean>): Promise<void> {
  const body = h('div', { class: 'calib' });
  const cancel = h('button', { type: 'button', text: t('calib.cancel') });
  let aborted = false;
  cancel.addEventListener('click', () => {
    aborted = true;
    dialog.close();
  });
  dialog.replaceChildren(h('h2', { text: t('calib.title') }), body, h('div', { class: 'row' }, [cancel]));
  if (!dialog.open) dialog.showModal();

  const step = (n: number, title: string, text: string, progress?: HTMLElement) =>
    setChildren(body, [h('p', { class: 'calib-step', text: t('calib.stepOf', { n, total: 5 }) }), h('h3', { text: title }), h('p', { text }), progress]);

  if (!(await ensureMic())) {
    step(1, t('calib.micTitle'), t('calib.micNeeded'));
    return;
  }
  const engine = ctx.engine;
  const measure = async (ms: number, withChord: boolean, bar: HTMLElement): Promise<FrameMeasure[]> => {
    const out: FrameMeasure[] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms && !aborted) {
      await new Promise((r) => setTimeout(r, 60));
      engine.pollFallback();
      const f = engine.ring.read(8192, engine.ring.lastFrame);
      if (!f) continue;
      if (withChord) {
        const a = analyzeFrame(f, engine.sampleRate, { ...ctx.detector.options, noiseGate: 0 });
        out.push({ rms: a.rms, confidence: a.confidence });
      } else {
        out.push({ rms: rms(f), confidence: 0 });
      }
      bar.style.width = `${Math.min(100, ((performance.now() - t0) / ms) * 100)}%`;
    }
    return out;
  };
  const progress = () => {
    const fill = h('div', { class: 'calib-fill' });
    return { el: h('div', { class: 'calib-bar' }, [fill]), fill };
  };

  // 1. Silence
  let p = progress();
  step(1, t('calib.silenceTitle'), t('calib.silenceText'), p.el);
  await new Promise((r) => setTimeout(r, 1200)); // le temps de lâcher le téléphone
  const silence = await measure(STEP_MS.silence, false, p.fill);
  if (aborted) return;

  // 2. Accord
  p = progress();
  step(2, t('calib.chordTitle'), t('calib.chordText'), p.el);
  await new Promise((r) => setTimeout(r, 800));
  const chord = await measure(STEP_MS.chord, true, p.fill);
  if (aborted) return;

  // 3 et 4. Analyse et recommandation
  const res = analyzeCalibration(silence, chord);
  showResult(ctx, dialog, body, res);
}

function showResult(ctx: AppContext, dialog: HTMLDialogElement, body: HTMLElement, r: CalibrationResult): void {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const apply = h('button', { type: 'button', class: 'primary', text: t('calib.apply') });
  apply.addEventListener('click', () => {
    // 5. Application
    const s = ctx.settings;
    s.profile = r.profile;
    s.sensitivity = r.sensitivity;
    ctx.detector.applyProfile(PROFILES[r.profile]);
    ctx.detector.noise.seed(r.noiseRms);
    ctx.commit();
    setChildren(body, [h('p', { class: 'calib-step', text: t('calib.stepOf', { n: 5, total: 5 }) }), h('h3', { text: t('calib.appliedTitle') }), h('p', { text: t('calib.applied', { profile: t(`profile.${r.profile}`) }) })]);
    const done = h('button', { type: 'button', class: 'primary', text: t('settings.close') });
    done.addEventListener('click', () => dialog.close());
    body.append(done);
  });
  setChildren(body, [
    h('p', { class: 'calib-step', text: t('calib.stepOf', { n: 4, total: 5 }) }),
    h('h3', { text: t('calib.resultTitle') }),
    h('p', { class: `calib-quality q-${r.quality}`, text: t(`calib.quality.${r.quality}`) }),
    h('ul', { class: 'calib-figures' }, [
      h('li', { text: t('calib.snr', { n: Math.round(r.snrDb) }) }),
      h('li', { text: t('calib.clarity', { n: pct(r.clarity) }) }),
      h('li', { text: t('calib.recommend', { profile: t(`profile.${r.profile}`) }) }),
    ]),
    h('ul', { class: 'calib-advice' }, r.advice.map((a) => h('li', { text: t(`calib.advice.${a}`) }))),
    apply,
  ]);
}
