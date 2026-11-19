import { describe, expect, it } from 'vitest';
import { customSignature, cycleBeatState, groupStarts, SIGNATURES, signatureById } from '../src/metronome/meter';
import { loadPresets, savePresets } from '../src/metronome/presets';
import { MetronomeScheduler, type TickEvent } from '../src/metronome/scheduler';
import { TapTempo } from '../src/metronome/tap-tempo';
import { acceleratedBpm, isSilentBar } from '../src/metronome/training';

/** Horloge simulée : on avance le temps à la main, avec des réveils irréguliers. */
class FakeClock {
  t = 0;
  now() {
    return this.t;
  }
}

function run(m: MetronomeScheduler, clock: FakeClock, seconds: number, jitter = true): TickEvent[] {
  const events: TickEvent[] = [];
  m.onTick((e) => events.push(e));
  m.start();
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const end = clock.t + seconds;
  while (clock.t < end) {
    // Réveil entre 5 et 60 ms (pire qu'un vrai navigateur), sans effet sur l'heure des clics.
    clock.t += jitter ? 0.005 + rand() * 0.055 : 0.025;
    m.tick();
  }
  return events;
}

describe('planificateur — précision', () => {
  it('zéro dérive sur 1 000 temps (120 BPM, réveils irréguliers)', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 120 });
    const events = run(m, clock, 1000 * 0.5 + 1).filter((e) => e.sub === 0);
    expect(events.length).toBeGreaterThanOrEqual(1000);
    const t0 = events[0]!.time;
    for (let i = 0; i < 1000; i++) expect(Math.abs(events[i]!.time - (t0 + i * 0.5))).toBeLessThan(1e-9);
  });
  it('zéro dérive à 137 BPM (période non ronde)', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 137 });
    const events = run(m, clock, 1000 * (60 / 137) + 1).filter((e) => e.sub === 0);
    const t0 = events[0]!.time;
    const p = 60 / 137;
    expect(Math.abs(events[999]!.time - (t0 + 999 * p))).toBeLessThan(1e-9);
  });
  it('chaque clic est planifié à l’avance (jamais dans le passé)', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 200 });
    const late: number[] = [];
    m.onTick((e) => {
      if (e.time < clock.t) late.push(e.time);
    });
    run(m, clock, 30);
    expect(late).toEqual([]);
  });
  it('les événements sont strictement croissants dans le temps', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 90, subdivision: 3 });
    const ev = run(m, clock, 20);
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.time).toBeGreaterThan(ev[i - 1]!.time);
  });
});

describe('planificateur — mesures et accents', () => {
  for (const sig of [...SIGNATURES, customSignature(11)]) {
    it(`accent sur le temps 1 seulement en ${sig.id}`, () => {
      const clock = new FakeClock();
      const m = new MetronomeScheduler(clock, { bpm: 240, signature: sig });
      const beats = run(m, clock, 20).filter((e) => e.sub === 0);
      for (const e of beats.slice(0, sig.beats * 5)) {
        expect(e.kind).toBe(e.beat === 0 ? 'accent' : 'normal');
        expect(e.beatsPerBar).toBe(sig.beats);
      }
      // Les mesures se suivent.
      const bars = beats.slice(0, sig.beats * 3).map((e) => e.bar);
      expect(bars).toEqual([...Array(sig.beats).fill(0), ...Array(sig.beats).fill(1), ...Array(sig.beats).fill(2)]);
    });
  }
  it('groupes 6/8 = 3+3 et 7/8 = 2+2+3', () => {
    expect([...groupStarts(signatureById('6/8')!)]).toEqual([0, 3]);
    expect([...groupStarts(signatureById('7/8')!)]).toEqual([0, 2, 4]);
  });
  it('états accentué → normal → muet ; un temps muet ne sonne pas', () => {
    expect(cycleBeatState('accent')).toBe('normal');
    expect(cycleBeatState('normal')).toBe('mute');
    expect(cycleBeatState('mute')).toBe('accent');
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 120, beatStates: ['accent', 'mute', 'accent', 'normal'] });
    const beats = run(m, clock, 4).filter((e) => e.sub === 0).slice(0, 4);
    expect(beats.map((e) => e.audible)).toEqual([true, false, true, true]);
    expect(beats.map((e) => e.kind)).toEqual(['accent', 'normal', 'accent', 'normal']);
  });
  it('subdivisions : croches, triolets, doubles croches, plus discrètes', () => {
    for (const s of [2, 3, 4] as const) {
      const clock = new FakeClock();
      const m = new MetronomeScheduler(clock, { bpm: 60, subdivision: s });
      const ev = run(m, clock, 3.05, false);
      const firstBeat = ev.filter((e) => e.beat === 0 && e.bar === 0);
      expect(firstBeat.length).toBe(s);
      expect(firstBeat.slice(1).every((e) => e.kind === 'sub')).toBe(true);
      expect(firstBeat[1]!.time - firstBeat[0]!.time).toBeCloseTo(1 / s, 9);
    }
  });
});

describe('planificateur — tempo', () => {
  it('changement de tempo au début du prochain temps, sans saut', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 60 });
    const ev: TickEvent[] = [];
    m.onTick((e) => ev.push(e));
    const t0 = m.start();
    while (clock.t < t0 + 2.5) {
      clock.t += 0.025;
      m.tick();
    }
    m.update({ bpm: 120 });
    while (clock.t < t0 + 6) {
      clock.t += 0.025;
      m.tick();
    }
    const times = ev.map((e) => e.time - t0);
    // 0,1,2 à 60 BPM (2 et 3 déjà planifiés éventuellement), puis 0,5 s d'écart.
    const gaps = times.slice(1).map((t, i) => +(t - times[i]!).toFixed(9));
    expect(gaps.filter((g) => g !== 1 && g !== 0.5)).toEqual([]);
    expect(gaps.slice(0, 2)).toEqual([1, 1]);
    expect(gaps[gaps.length - 1]).toBe(0.5);
  });
  it('limites 20–300 BPM', () => {
    const m = new MetronomeScheduler(new FakeClock(), { bpm: 500 });
    m.start();
    expect(m.bpmNow).toBe(300);
    m.update({ bpm: 5 });
    expect(m.config.bpm).toBe(20);
  });
});

describe('entraînement', () => {
  it('décompte de 2 mesures avant de démarrer', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 240, countInBars: 2, subdivision: 2 });
    const ev = run(m, clock, 6);
    const countIn = ev.filter((e) => e.countIn);
    expect(countIn.length).toBe(8); // 2 mesures × 4 temps, sans subdivisions
    expect(countIn.map((e) => e.bar)).toEqual([-2, -2, -2, -2, -1, -1, -1, -1]);
    expect(ev.find((e) => !e.countIn)!.bar).toBe(0);
  });
  it('accélérateur : +5 BPM toutes les 2 mesures jusqu’à 110', () => {
    const cfg = { enabled: true, stepBpm: 5, everyBars: 2, targetBpm: 110 };
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((b) => acceleratedBpm(100, cfg, b))).toEqual([100, 100, 105, 105, 110, 110, 110, 110]);
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 100, accelerator: cfg });
    const beats = run(m, clock, 20).filter((e) => e.sub === 0);
    expect(beats.filter((e) => e.bar === 1).every((e) => e.bpm === 100)).toBe(true);
    expect(beats.filter((e) => e.bar === 2).every((e) => e.bpm === 105)).toBe(true);
    expect(beats.filter((e) => e.bar === 5).every((e) => e.bpm === 110)).toBe(true);
  });
  it('mesures silencieuses : 2 jouées, 1 muette', () => {
    const cfg = { enabled: true, playBars: 2, muteBars: 1 };
    expect([0, 1, 2, 3, 4, 5].map((b) => isSilentBar(cfg, b))).toEqual([false, false, true, false, false, true]);
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 240, silent: cfg });
    const beats = run(m, clock, 5).filter((e) => e.sub === 0 && e.bar === 2);
    expect(beats.length).toBe(4);
    expect(beats.every((e) => !e.audible)).toBe(true);
  });
});

describe('TAP tempo', () => {
  const tapAt = (tt: TapTempo, times: number[]) => times.map((t) => tt.tap(t));
  it('BPM dès le 2e tap, puis affiné', () => {
    const tt = new TapTempo();
    const r = tapAt(tt, [0, 0.5]);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeCloseTo(120);
  });
  it('tempo correct avec un léger flou humain', () => {
    const tt = new TapTempo();
    const times = [0, 0.51, 0.99, 1.5, 2.02, 2.49, 3.0, 3.51, 4.0];
    const bpm = tapAt(tt, times).pop()!;
    expect(bpm).toBeGreaterThan(118);
    expect(bpm).toBeLessThan(122);
  });
  it('rejette un double tap accidentel', () => {
    const tt = new TapTempo();
    const bpm = tapAt(tt, [0, 0.5, 1.0, 1.06, 1.5, 2.0]).pop()!;
    expect(bpm).toBeCloseTo(120, 5);
  });
  it('rejette un intervalle aberrant (tap oublié)', () => {
    const tt = new TapTempo();
    const bpm = tapAt(tt, [0, 0.5, 1.0, 1.5, 2.5, 3.0, 3.5]).pop()!;
    expect(bpm).toBeCloseTo(120, 5);
  });
  it('repart à zéro après 2 s sans tap', () => {
    const tt = new TapTempo();
    tapAt(tt, [0, 0.5, 1.0]);
    expect(tt.tap(3.5)).toBeNull();
    expect(tt.tap(4.25)).toBeCloseTo(80);
  });
  it('utilise au plus les 8 derniers intervalles', () => {
    const tt = new TapTempo();
    const slow = [0, 1, 2, 3, 4]; // 60 BPM
    const fast = Array.from({ length: 9 }, (_, i) => 4.5 + i * 0.5); // 120 BPM
    tapAt(tt, slow);
    // Le passage de 1 s à 0,5 s : le premier 0,5 est un « double tap » ? non (0,5 = 50 % de 1) → accepté.
    expect(tapAt(tt, fast).pop()).toBeCloseTo(120, 5);
  });
});

describe('préréglages', () => {
  it('sauvegarde et relecture locales ; stockage absent ou corrompu toléré', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const list = loadPresets(store);
    expect(list.some((p) => p.signatureId === '6/8' && p.bpm === 72)).toBe(true);
    savePresets(store, [{ name: 'Test', bpm: 90, signatureId: '3/4', beatStates: ['accent', 'normal', 'normal'], subdivision: 1, sound: 'beep' }]);
    expect(loadPresets(store).map((p) => p.name)).toEqual(['Test']);
    mem.set('pa.presets.v1', '{pas du json');
    expect(loadPresets(store).length).toBeGreaterThan(0);
    expect(loadPresets(null).length).toBeGreaterThan(0);
  });
});

describe('robustesse', () => {
  it('page gelée 3 s : pas de rafale de clics au réveil, la grille reste intacte', () => {
    const clock = new FakeClock();
    const m = new MetronomeScheduler(clock, { bpm: 120 });
    const ev: TickEvent[] = [];
    m.onTick((e) => ev.push(e));
    const t0 = m.start();
    while (clock.t < t0 + 2) {
      clock.t += 0.025;
      m.tick();
    }
    clock.t += 3; // gel
    m.tick();
    while (clock.t < t0 + 8) {
      clock.t += 0.025;
      m.tick();
    }
    const beats = ev.filter((e) => e.sub === 0);
    beats.forEach((e, i) => expect(Math.abs(e.time - (t0 + i * 0.5))).toBeLessThan(1e-9));
    const late = beats.filter((e) => e.late);
    expect(late.length).toBeGreaterThanOrEqual(5);
    expect(late.every((e) => !e.audible)).toBe(true);
    expect(beats.filter((e) => e.time > t0 + 5.2).every((e) => e.audible && !e.late)).toBe(true);
  });
});
