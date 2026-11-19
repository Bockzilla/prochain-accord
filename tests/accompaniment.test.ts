import { describe, expect, it } from 'vitest';
import { arrangeBeat, bassMidi, chordForBar, chordVoicing, type ArrangeContext, type NoteEvent } from '../src/accompaniment/arranger';
import { BandVoice } from '../src/accompaniment/band';
import { STYLE_DEFS } from '../src/accompaniment/patterns';
import { signatureById } from '../src/metronome/meter';
import { MetronomeScheduler, type TickEvent } from '../src/metronome/scheduler';
import { chord, chordPitchClasses } from '../src/theory/chords';
import { PROGRESSIONS, realizeProgression, STYLES } from '../src/theory/harmony';
import { mod12 } from '../src/theory/notes';

class FakeClock {
  t = 0;
  now() {
    return this.t;
  }
}

/** Fait tourner le métronome ET l'arrangeur sur la même horloge. */
function play(ctx: ArrangeContext, bpm: number, seconds: number, countInBars: 0 | 1 | 2 = 0) {
  const clock = new FakeClock();
  const m = new MetronomeScheduler(clock, { bpm, countInBars, signature: signatureById('4/4')! });
  const beats: TickEvent[] = [];
  const notes: (NoteEvent & { bar: number; beat: number })[] = [];
  m.onTick((e) => {
    if (e.sub === 0) beats.push(e);
    for (const n of arrangeBeat(e, ctx)) notes.push({ ...n, bar: e.bar, beat: e.beat });
  });
  const t0 = m.start();
  while (clock.t < t0 + seconds) {
    clock.t += 0.005 + Math.random() * 0.04; // réveils irréguliers
    m.tick();
  }
  return { beats, notes, t0 };
}

const blues = realizeProgression(PROGRESSIONS.find((p) => p.id === 'blues12')!, 9); // blues en La

describe('arrangeur — synchronisation avec le métronome', () => {
  for (const style of STYLES) {
    it(`${style} : chaque grosse caisse tombe EXACTEMENT sur un temps du métronome`, () => {
      const { beats, notes } = play({ style, loop: blues.chords, barOffset: 0 }, 100, 30);
      const beatTimes = new Set(beats.map((b) => b.time.toFixed(9)));
      const kicks = notes.filter((n) => n.part === 'kick' && n.time === beats.find((b) => b.bar === n.bar && b.beat === n.beat)!.time);
      expect(kicks.length).toBeGreaterThan(20);
      for (const k of kicks) expect(beatTimes.has(k.time.toFixed(9))).toBe(true);
      // Toute note tombe dans le temps qui l'a produite (jamais avant, jamais au-delà du temps suivant).
      const period = 60 / 100;
      for (const n of notes) {
        const b = beats.find((x) => x.bar === n.bar && x.beat === n.beat)!;
        expect(n.time).toBeGreaterThanOrEqual(b.time);
        expect(n.time - b.time).toBeLessThan(period);
      }
    });
  }
  it('swing du blues : la 2e croche est à 2/3 du temps', () => {
    const { beats, notes } = play({ style: 'blues', loop: blues.chords, barOffset: 0 }, 90, 6);
    const b = beats.find((x) => x.bar === 1 && x.beat === 0)!;
    const hats = notes.filter((n) => n.part === 'hat' && n.bar === 1 && n.beat === 0).map((n) => n.time - b.time);
    expect(hats[0]).toBeCloseTo(0, 9);
    expect(hats[1]).toBeCloseTo((2 / 3) * (60 / 90), 9);
    expect(STYLE_DEFS.rock.swing).toBe(0.5);
  });
  it('décompte : aucune note d’accompagnement pendant les mesures de décompte', () => {
    const { notes, beats } = play({ style: 'rock', loop: blues.chords, barOffset: 0 }, 120, 6, 2);
    expect(beats.filter((b) => b.countIn).length).toBe(8);
    expect(notes.every((n) => n.bar >= 0)).toBe(true);
    expect(notes.some((n) => n.bar === 0)).toBe(true);
  });
  it('changement de tempo : l’accompagnement suit le métronome sans décalage', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 80 });
    const notes: { time: number; beatTime: number }[] = [];
    m.onTick((e) => arrangeBeat(e, { style: 'country', loop: [chord(0)], barOffset: 0 }).forEach((n) => notes.push({ time: n.time, beatTime: e.time })));
    m.start();
    while (clock.t < 3) (clock.t += 0.02), m.tick();
    m.update({ bpm: 140 });
    while (clock.t < 8) (clock.t += 0.02), m.tick();
    // Les grosses caisses (sur le temps) coïncident toujours avec l'heure du temps.
    expect(notes.filter((n) => n.time === n.beatTime).length).toBeGreaterThan(10);
  });
});

describe('arrangeur — accords et notes', () => {
  it('l’accord joué suit la boucle mesure par mesure (12 mesures de blues)', () => {
    const { notes } = play({ style: 'blues', loop: blues.chords, barOffset: 0 }, 160, 12 * 4 * (60 / 160) + 1);
    for (let bar = 0; bar < 12; bar++) {
      const chordNotes = notes.filter((n) => n.part === 'chord' && n.bar === bar);
      const want = new Set(chordPitchClasses(blues.chords[bar]!));
      for (const c of chordNotes) expect(new Set(c.midi.map(mod12))).toEqual(want);
    }
  });
  it('pause puis reprise : la boucle repart à la bonne mesure', () => {
    const ctx = { style: 'folk' as const, loop: blues.chords, barOffset: 5 };
    expect(chordForBar(ctx, 0)!.index).toBe(5);
    expect(chordForBar(ctx, 7)!.index).toBe(0);
    expect(chordForBar(ctx, -1)).toBeNull();
  });
  it('basse : bonne note, dans le registre grave, pour les 12 tonalités', () => {
    for (let r = 0; r < 12; r++)
      for (const q of ['maj', 'min', '7'] as const) {
        const c = chord(r, q);
        expect(mod12(bassMidi(c, '1'))).toBe(r);
        expect(mod12(bassMidi(c, '5'))).toBe(mod12(r + 7));
        expect(mod12(bassMidi(c, '3'))).toBe(mod12(r + (q === 'min' ? 3 : 4)));
        expect(bassMidi(c, '1')).toBeGreaterThanOrEqual(40);
        expect(bassMidi(c, '1')).toBeLessThanOrEqual(51);
      }
  });
  it('voicings : exactement les notes de l’accord ; power chord = fondamentale + quinte', () => {
    for (let r = 0; r < 12; r++) {
      const c = chord(r, 'min');
      expect(new Set(chordVoicing(c, false).map(mod12))).toEqual(new Set(chordPitchClasses(c)));
      expect(chordVoicing(c, true).map((m) => mod12(m - r))).toEqual([0, 7, 0]);
    }
  });
});

// --- Faux contexte audio : compte les nœuds pour détecter les fuites ---
class FakeParam {
  value = 0;
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  connected = 0;
  static live = 0;
  constructor() {
    FakeNode.live++;
  }
  connect(n: unknown) {
    this.connected++;
    return n;
  }
  disconnect() {
    if (this.connected > 0) FakeNode.live--;
    this.connected = 0;
  }
}
class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  started = false;
  stoppedAt: number | null = null;
  frequency = new FakeParam();
  playbackRate = new FakeParam();
  type = '';
  buffer: unknown = null;
  static all: FakeSource[] = [];
  constructor() {
    super();
    FakeSource.all.push(this);
  }
  start() {
    this.started = true;
  }
  stop(t?: number) {
    this.stoppedAt = t ?? 0;
  }
}
function fakeCtx() {
  return {
    currentTime: 0,
    sampleRate: 48000,
    createGain: () => Object.assign(new FakeNode(), { gain: new FakeParam() }),
    createOscillator: () => new FakeSource(),
    createBufferSource: () => new FakeSource(),
    createBiquadFilter: () => Object.assign(new FakeNode(), { frequency: new FakeParam(), Q: new FakeParam(), type: '' }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
}

describe('orchestre — ressources audio', () => {
  it('chaque source est arrêtée et chaque nœud débranché à la fin des notes (aucune fuite)', () => {
    FakeNode.live = 0;
    FakeSource.all = [];
    const ctx = fakeCtx();
    const band = new BandVoice(ctx as never, new FakeNode() as never);
    const baseline = FakeNode.live;
    const { notes } = play({ style: 'rock', loop: blues.chords, barOffset: 0 }, 120, 8);
    notes.forEach((n) => band.play(n));
    expect(band.activeSources).toBeGreaterThan(50);
    expect(FakeSource.all.every((s) => s.started && s.stoppedAt !== null)).toBe(true);
    // Fin naturelle de toutes les notes
    for (const s of FakeSource.all) s.onended?.();
    expect(band.activeSources).toBe(0);
    expect(FakeNode.live).toBe(baseline);
  });
  it('Arrêt : coupe immédiatement les notes déjà planifiées et libère tout', () => {
    FakeNode.live = 0;
    FakeSource.all = [];
    const band = new BandVoice(fakeCtx() as never, new FakeNode() as never);
    const baseline = FakeNode.live;
    const { notes } = play({ style: 'blues', loop: blues.chords, barOffset: 0 }, 100, 4);
    notes.forEach((n) => band.play(n));
    band.stopAll();
    expect(band.activeSources).toBe(0);
    expect(FakeNode.live).toBe(baseline);
    expect(FakeSource.all.every((s) => s.stoppedAt !== null)).toBe(true);
  });
});
