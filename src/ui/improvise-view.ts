import { NoteTracker, type PlayedNote } from '../detection/note-tracker';
import { yinPitch } from '../detection/pitch';
import { getLocale, t } from '../i18n/i18n';
import { noteName, pcName } from '../i18n/notation';
import { h, setChildren } from '../render/dom';
import { noteKey, renderNeck, type NeckHandle } from '../render/neck-svg';
import { playChord } from '../synth/chord-player';
import { chordPitchClasses, type Chord } from '../theory/chords';
import { noteLevel, pentatonicPositions, positionRange, positionsOfMidi, scaleOnNeck, STANDARD_TUNING, type NeckNote } from '../theory/fretboard';
import { keySpelling } from '../theory/keys';
import { mod12, spell } from '../theory/notes';
import { isMinorScale, isPentatonic, scaleNotes, SCALE_TYPES, type Scale, type ScaleType } from '../theory/scales';
import type { AccompanimentController } from './accompaniment-controller';
import { nameOf, type AppContext } from './context';
import { keyLabel, keyPicker } from './key-picker';
import type { SharedMusic } from './shared';

const NECK_FRETS = 17;
const PITCH_FRAME = 4096;

/**
 * Espace « Improviser » : manche interactif, gammes, 5 positions pentatoniques,
 * notes cibles de l'accord en cours (accompagnement) et note jouée détectée au micro.
 */
export class ImproviseView {
  readonly el: HTMLElement;
  private neck: NeckHandle | null = null;
  private tracker = new NoteTracker();
  private timer: ReturnType<typeof setInterval> | null = null;
  private played: PlayedNote | null = null;
  private playedEl = h('p', { class: 'played-readout', 'aria-live': 'polite' });
  private chordLine = h('div', { class: 'target-line' });
  private lastChordId = '';

  constructor(
    private ctx: AppContext,
    private shared: SharedMusic,
    private acc: AccompanimentController,
  ) {
    this.el = h('section', { id: 'view-improvise', class: 'view', 'aria-labelledby': 'tab-improvise' });
    shared.on(() => {
      if (!this.el.hidden) this.render();
    });
    // Accord de l'accompagnement : les notes cibles changent dès que l'accord change.
    acc.on(() => {
      const c = this.bandChord;
      const id = c ? `${c.root}:${c.quality}` : '';
      if (id !== this.lastChordId) {
        this.lastChordId = id;
        if (!this.el.hidden) this.render();
      }
    });
    this.render();
  }

  private get bandChord(): Chord | null {
    return this.acc.state === 'playing' && !this.acc.countingIn && this.acc.currentIndex >= 0 ? this.acc.loop[this.acc.currentIndex] ?? null : null;
  }

  /** Gamme affichée : on adapte la tonique au mode de la gamme (La mineur ↔ Do majeur). */
  get scale(): Scale {
    const key = this.shared.key;
    const type = this.ctx.settings.music.scale;
    const wantMinor = isMinorScale(type);
    const keyMinor = key.mode === 'minor';
    const tonic = wantMinor === keyMinor ? key.tonic : wantMinor ? (key.tonic + 9) % 12 : (key.tonic + 3) % 12;
    return { tonic, type };
  }

  /** Affiche une gamme précise (appelé depuis « Comprendre »). */
  show(scale: Scale): void {
    this.ctx.settings.music.scale = scale.type;
    this.shared.setManualKey({ tonic: scale.tonic, mode: isMinorScale(scale.type) ? 'minor' : 'major' });
    this.ctx.commit();
  }

  render(): void {
    const m = this.ctx.settings.music;
    const sc = this.scale;
    const spelling = keySpelling({ tonic: sc.tonic, mode: isMinorScale(sc.type) ? 'minor' : 'major' });
    const name = (pc: number) => noteName(spell(pc, spelling), this.ctx.settings.notation, getLocale());
    const penta = isPentatonic(sc.type);
    const positions = penta ? pentatonicPositions(sc) : [];
    if (!penta && m.position !== 0) m.position = 0;
    const pos = penta ? Math.max(0, Math.min(5, m.position)) : 0;
    const box = pos > 0 ? positions[pos - 1]! : null;
    const notes = scaleOnNeck(sc, STANDARD_TUNING, NECK_FRETS);
    const boxSet = box ? new Set(box.map(noteKey)) : null;
    const boxRange = box ? positionRange(box) : null;
    const band = this.bandChord;
    const chordPcs = new Set(band ? chordPitchClasses(band) : []);
    const label = (n: NeckNote) => (m.labels === 'intervals' ? n.interval : name(n.pc));

    const scaleSel = h('select', { 'aria-label': t('improvise.scale') });
    for (const st of SCALE_TYPES) scaleSel.append(h('option', { value: st, text: t(`scale.${st}`), selected: st === sc.type }));
    scaleSel.addEventListener('change', () => {
      m.scale = scaleSel.value as ScaleType;
      if (!isPentatonic(m.scale)) m.position = 0;
      else if (m.position === 0) m.position = 1;
      this.ctx.commit();
      this.render();
    });

    const posRow = h('div', { class: 'row center pos-row' });
    if (penta) {
      const prev = h('button', { type: 'button', class: 'nav', 'aria-label': t('improvise.prevPos'), text: '◀' });
      const next = h('button', { type: 'button', class: 'nav', 'aria-label': t('improvise.nextPos'), text: '▶' });
      prev.addEventListener('click', () => this.setPos((pos + 5) % 6));
      next.addEventListener('click', () => this.setPos((pos + 1) % 6));
      posRow.append(prev, h('span', { class: 'pos-label', text: box ? t('improvise.position', { n: pos, from: boxRange!.from, to: boxRange!.to }) : t('improvise.wholeNeck') }), next);
    }

    const labelsBtn = h('button', { type: 'button', text: m.labels === 'notes' ? t('improvise.showIntervals') : t('improvise.showNotes') });
    labelsBtn.addEventListener('click', () => {
      m.labels = m.labels === 'notes' ? 'intervals' : 'notes';
      this.ctx.commit();
      this.render();
    });
    const beginner = h('input', { type: 'checkbox', checked: m.beginner });
    beginner.addEventListener('change', () => {
      m.beginner = beginner.checked;
      this.ctx.commit();
      this.render();
    });

    this.neck = renderNeck({
      tuning: STANDARD_TUNING,
      frets: NECK_FRETS,
      notes,
      levelOf: (n) => noteLevel(n, { playedMidi: null, chordPcs, box: boxSet, boxRange }),
      label,
      lefty: this.ctx.settings.lefty,
      title: t('improvise.neckTitle', { scale: this.scaleName(sc, name) }),
      onNote: (n) => void this.ctx.engine.resume().then(() => playChord(this.ctx.engine.ctx, this.ctx.engine.synthBus, [n.midi], 'block')),
      bands: positions.map((b, i) => ({ index: i + 1, ...positionRange(b), selected: i + 1 === pos })),
      bandLabel: (i) => t('improvise.bandLabel', { n: i }),
    });
    const neckBox = h('div', { class: 'neck-scroll', tabindex: 0, 'aria-label': t('improvise.scrollHint') }, [this.neck.svg]);

    // Accord de l'accompagnement et explication des notes cibles.
    if (band) {
      const inScale = new Set(scaleNotes(sc));
      const tones = chordPitchClasses(band);
      const outside = tones.filter((p) => !inScale.has(p));
      this.chordLine.replaceChildren(
        h('p', { class: 'target-chord' }, [h('span', { class: 'target-badge', text: nameOf(this.ctx, band, this.acc.loopKey) }), ` ${t('improvise.targetsOf', { notes: tones.map((p) => name(p)).join(' – ') })}`]),
        h('p', { class: 'small', text: outside.length ? t('improvise.targetsWhyOutside', { notes: outside.map((p) => name(p)).join(', ') }) : t('improvise.targetsWhy') }),
      );
    } else {
      this.chordLine.replaceChildren(h('p', { class: 'small', text: t('improvise.noBand') }));
    }

    setChildren(this.el, [
      h('div', { class: 'card' }, [
        h('h2', { text: t('improvise.title') }),
        keyPicker(this.ctx, this.shared),
        h('label', { class: 'field' }, [h('span', { text: t('improvise.scale') }), scaleSel]),
        h('p', { class: 'scale-name', text: this.scaleName(sc, name) }),
        h('p', { class: 'scale-notes', text: scaleNotes(sc).map(name).join(' · ') }),
      ]),
      h('div', { class: 'card neck-card' }, [
        this.chordLine,
        this.playedEl,
        posRow,
        neckBox,
        h('ul', { class: 'legend' }, [
          h('li', {}, [h('span', { class: 'lg played', 'aria-hidden': 'true' }), t('improvise.legendPlayed')]),
          h('li', {}, [h('span', { class: 'lg chord', 'aria-hidden': 'true' }), t('improvise.legendChord')]),
          h('li', {}, [h('span', { class: 'lg root', 'aria-hidden': 'true' }), t('improvise.legendRoot')]),
          h('li', {}, [h('span', { class: 'lg note', 'aria-hidden': 'true' }), t('improvise.legendNote')]),
          penta ? h('li', {}, [h('span', { class: 'lg near', 'aria-hidden': 'true' }), t('improvise.legendNear')]) : null,
        ]),
        h('div', { class: 'row' }, [labelsBtn]),
        h('p', { class: 'small', text: t('improvise.tapHint') }),
      ]),
      h('label', { class: 'check' }, [beginner, h('span', { text: t('improvise.beginner') })]),
      m.beginner ? this.beginnerPanel(sc, pos) : null,
    ]);
    neckBox.scrollLeft = boxRange ? Math.max(0, boxRange.from * 40 - 30) : 0;
    this.showPlayed();
  }

  private setPos(p: number): void {
    this.ctx.settings.music.position = p;
    this.ctx.commit();
    this.render();
  }

  // ---------------------------------------------------------------- note jouée (micro)

  /** Mesure de la note jouée, seulement quand l'espace est visible. */
  setActive(on: boolean): void {
    if (on && !this.timer) this.timer = setInterval(() => this.tick(), 40);
    else if (!on && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.tracker.reset();
      this.played = null;
      this.showPlayed();
    }
  }

  private tick(): void {
    const e = this.ctx.engine;
    e.pollFallback();
    const fresh = e.ring.lastFrame > (e.ctx.currentTime - 0.3) * e.sampleRate;
    const frame = fresh ? e.ring.read(PITCH_FRAME, e.ring.lastFrame) : null;
    this.tracker.a4 = this.ctx.settings.a4;
    const n = this.tracker.update(frame ? yinPitch(frame, e.sampleRate) : null, performance.now());
    if (n?.midi !== this.played?.midi || (n && this.played && n.cents !== this.played.cents)) {
      this.played = n;
      this.showPlayed();
    }
  }

  private showPlayed(): void {
    const n = this.played;
    const sc = this.scale;
    const name = noteName(spell(n ? mod12(n.midi) : 0, keySpelling({ tonic: sc.tonic, mode: isMinorScale(sc.type) ? 'minor' : 'major' })), this.ctx.settings.notation, getLocale());
    this.neck?.setPlayed(n ? n.midi : null, name);
    if (!n) {
      this.playedEl.textContent = this.ctx.engine.micActive ? t('improvise.listening') : t('improvise.micHint');
      this.playedEl.className = 'played-readout';
      return;
    }
    const where = positionsOfMidi(n.midi, STANDARD_TUNING, NECK_FRETS).length;
    const inScale = scaleNotes(sc).includes(mod12(n.midi));
    const band = this.bandChord;
    const onChord = !!band && chordPitchClasses(band).includes(mod12(n.midi));
    const octave = Math.floor(n.midi / 12) - 1;
    this.playedEl.textContent = t(onChord ? 'improvise.playedChord' : inScale ? 'improvise.playedIn' : 'improvise.playedOut', { note: `${name}${octave}`, cents: `${n.cents > 0 ? '+' : ''}${n.cents}`, n: where });
    this.playedEl.className = `played-readout on ${onChord ? 'chord' : inScale ? 'in' : 'out'}`;
  }

  private scaleName(sc: Scale, name: (pc: number) => string): string {
    return t('improvise.scaleName', { root: name(sc.tonic), scale: t(`scale.${sc.type}`) });
  }

  private beginnerPanel(sc: Scale, pos: number): HTMLElement {
    const k = this.shared.key;
    return h('div', { class: 'card beginner' }, [
      h('h3', { text: t('beginner.title') }),
      h('p', { text: t(`beginner.scale.${sc.type}`) }),
      h('p', { text: t('beginner.roots') }),
      h('p', { text: t('beginner.targets') }),
      h('p', { text: isPentatonic(sc.type) ? (pos > 0 ? t('beginner.position') : t('beginner.wholeNeck')) : t('beginner.fullScale') }),
      h('p', { text: t('beginner.intervals') }),
      h('p', { class: 'small', text: t('beginner.keyContext', { key: keyLabel(this.ctx, k), tonic: pcName(sc.tonic, this.ctx.settings.notation, getLocale()) }) }),
    ]);
  }
}
