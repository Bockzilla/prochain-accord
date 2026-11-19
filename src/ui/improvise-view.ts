import { getLocale, t } from '../i18n/i18n';
import { noteName, pcName } from '../i18n/notation';
import { h, setChildren } from '../render/dom';
import { noteKey, renderNeck } from '../render/neck-svg';
import { playChord } from '../synth/chord-player';
import { pentatonicPositions, positionRange, scaleOnNeck, STANDARD_TUNING, type NeckNote } from '../theory/fretboard';
import { keySpelling } from '../theory/keys';
import { spell } from '../theory/notes';
import { isMinorScale, isPentatonic, scaleNotes, SCALE_TYPES, type Scale, type ScaleType } from '../theory/scales';
import type { AppContext } from './context';
import { keyLabel, keyPicker } from './key-picker';
import type { SharedMusic } from './shared';

const NECK_FRETS = 17;

/** Espace « Improviser » : manche interactif, gammes, 5 positions pentatoniques. */
export class ImproviseView {
  readonly el: HTMLElement;

  constructor(
    private ctx: AppContext,
    private shared: SharedMusic,
  ) {
    this.el = h('section', { id: 'view-improvise', class: 'view', 'aria-labelledby': 'tab-improvise' });
    shared.on(() => {
      if (!this.el.hidden) this.render();
    });
    this.render();
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
    // Les notes « blue » de la position (♭5) font partie de la gamme blues : elles sont déjà dans `notes`.
    const focus = box ? new Set(box.map(noteKey)) : null;
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
      const r = box ? positionRange(box) : null;
      posRow.append(prev, h('span', { class: 'pos-label', text: box ? t('improvise.position', { n: pos, from: r!.from, to: r!.to }) : t('improvise.wholeNeck') }), next);
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

    const neck = renderNeck({
      tuning: STANDARD_TUNING,
      frets: NECK_FRETS,
      notes,
      focus,
      label,
      lefty: this.ctx.settings.lefty,
      title: t('improvise.neckTitle', { scale: this.scaleName(sc, name) }),
      onNote: (n) => {
        void this.ctx.engine.resume().then(() => playChord(this.ctx.engine.ctx, this.ctx.engine.synthBus, [n.midi], 'block'));
      },
    });
    const neckBox = h('div', { class: 'neck-scroll', tabindex: 0, 'aria-label': t('improvise.scrollHint') }, [neck]);

    const notesLine = scaleNotes(sc)
      .map((pc) => `${name(pc)}`)
      .join(' · ');

    setChildren(this.el, [
      h('div', { class: 'card' }, [
        h('h2', { text: t('improvise.title') }),
        keyPicker(this.ctx, this.shared),
        h('label', { class: 'field' }, [h('span', { text: t('improvise.scale') }), scaleSel]),
        h('p', { class: 'scale-name', text: this.scaleName(sc, name) }),
        h('p', { class: 'scale-notes', text: notesLine }),
      ]),
      h('div', { class: 'card neck-card' }, [
        posRow,
        neckBox,
        h('div', { class: 'legend' }, [
          h('span', { class: 'lg root', 'aria-hidden': 'true' }),
          h('span', { text: t('improvise.legendRoot') }),
          h('span', { class: 'lg note', 'aria-hidden': 'true' }),
          h('span', { text: t('improvise.legendNote') }),
        ]),
        h('div', { class: 'row' }, [labelsBtn]),
        h('p', { class: 'small', text: t('improvise.tapHint') }),
      ]),
      h('label', { class: 'check' }, [beginner, h('span', { text: t('improvise.beginner') })]),
      m.beginner ? this.beginnerPanel(sc, pos) : null,
    ]);
    neckBox.scrollLeft = box ? Math.max(0, positionRange(box).from * 40 - 30) : 0;
  }

  private setPos(p: number): void {
    this.ctx.settings.music.position = p;
    this.ctx.commit();
    this.render();
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
      h('p', { text: isPentatonic(sc.type) ? (pos > 0 ? t('beginner.position') : t('beginner.wholeNeck')) : t('beginner.fullScale') }),
      h('p', { text: t('beginner.intervals') }),
      h('p', { class: 'small', text: t('beginner.keyContext', { key: keyLabel(this.ctx, k), tonic: pcName(sc.tonic, this.ctx.settings.notation, getLocale()) }) }),
    ]);
  }
}
