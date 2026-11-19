import { midiToFreq } from '../theory/notes';

/** Petit synthé « corde pincée » pour entendre un accord quand on touche un diagramme. */
export function playChord(ctx: BaseAudioContext, out: AudioNode, midis: number[], style: 'strum' | 'block'): void {
  const t0 = ctx.currentTime + 0.02;
  const sorted = [...midis].sort((a, b) => a - b);
  sorted.forEach((m, i) => {
    const t = t0 + (style === 'strum' ? i * 0.045 : 0);
    const f = midiToFreq(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 / Math.sqrt(sorted.length), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(8000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + 1.2);
    lp.connect(g).connect(out);
    for (const [type, mult, amp] of [['triangle', 1, 1], ['sine', 2, 0.3]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + 1.9);
    }
  });
}
