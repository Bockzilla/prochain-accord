import { t } from '../i18n/i18n';
import { FRETTED } from '../instruments/model';
import { pianoInversions } from '../instruments/piano';
import { chordPositions } from '../instruments/positions';
import { soundingMidi } from '../instruments/validate';
import { h } from '../render/dom';
import { renderFretboard } from '../render/fretboard-svg';
import { renderKeyboard } from '../render/keyboard-svg';
import { playChord } from '../synth/chord-player';
import type { Chord } from '../theory/chords';
import { nameOf, noteOf, type AppContext } from './context';

export interface DiagramResult {
  el: HTMLElement;
  count: number;
  index: number;
  caption: string;
  midi: number[];
}

/** Diagramme de l'accord sur l'instrument d'affichage choisi (indépendant de l'instrument écouté). */
export function chordDiagram(ctx: AppContext, c: Chord, index: number, compact: boolean): DiagramResult {
  const s = ctx.settings;
  const name = nameOf(ctx, c);
  if (s.instrument === 'piano') {
    const invs = pianoInversions(c);
    const i = ((index % invs.length) + invs.length) % invs.length;
    const v = invs[i]!;
    const caption = t(`inversion.${Math.min(i, 3)}`);
    const svg = renderKeyboard(v, { compact, label: `${name} — ${caption}`, noteLabel: (pc) => noteOf(ctx, pc) });
    return wrap(ctx, svg, invs.length, i, caption, v.midi);
  }
  const inst = FRETTED[s.instrument];
  const pos = chordPositions(inst, c);
  const i = ((index % pos.length) + pos.length) % pos.length;
  const f = pos[i]!;
  const caption = `${t(`shape.${f.label}`)}${f.baseFret > 1 ? ` · ${t('diagram.fret', { n: f.baseFret })}` : ''}`;
  const svg = renderFretboard(inst, f, {
    lefty: s.lefty,
    compact,
    label: `${name} — ${caption}`,
    baseFretLabel: (n) => t('diagram.fretShort', { n }),
  });
  const midi = soundingMidi(inst, f.frets);
  return wrap(ctx, svg, pos.length, i, caption, midi);
}

function wrap(ctx: AppContext, svg: SVGElement, count: number, index: number, caption: string, midi: number[]): DiagramResult {
  const el = h('button', { type: 'button', class: 'diagram', 'aria-label': t('diagram.play') }, [svg]);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    void ctx.engine.resume().then(() => playChord(ctx.engine.ctx, ctx.engine.synthBus, midi, ctx.settings.playStyle));
  });
  return { el, count, index, caption, midi };
}
