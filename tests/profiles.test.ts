import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../src/audio/ring-buffer';
import { ChordDetector } from '../src/detection/detector';
import { PROFILE_IDS, PROFILES, type ProfileId } from '../src/detection/profiles';
import { GUITAR } from '../src/instruments/model';
import { chordPositions } from '../src/instruments/positions';
import { soundingMidi } from '../src/instruments/validate';
import { chord, chordId, type Chord } from '../src/theory/chords';
import { midiToFreq } from '../src/theory/notes';

const SR = 48000;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

/** Flux simulé : accords successifs + bruit + éventuelles rafales de bruit (porte qui claque, voix…). */
export function stream(seq: { c: Chord; dur: number }[], noise: number, bursts = false, seed = 5, burstLevel = 0.12): Float32Array {
  const r = rng(seed);
  const total = Math.round(seq.reduce((a, x) => a + x.dur, 0) * SR);
  const out = new Float32Array(total);
  let off = 0;
  for (const { c, dur } of seq) {
    const midis = soundingMidi(GUITAR, chordPositions(GUITAR, c)[0]!.frets);
    const n = Math.round(dur * SR);
    for (const m of midis)
      for (let h = 1; h <= 5; h++) {
        const f = midiToFreq(m) * h;
        const ph = r() * 3;
        for (let i = 0; i < n; i++) out[off + i]! += (0.06 / h) * Math.exp((-0.8 * i) / SR) * Math.sin((2 * Math.PI * f * i) / SR + ph);
      }
    off += n;
  }
  for (let i = 0; i < total; i++) {
    let v = noise * r();
    if (bursts && i % Math.round(0.3 * SR) < 0.09 * SR) v += burstLevel * r(); // rafale de 90 ms toutes les 300 ms
    out[i]! += v;
  }
  return out;
}

export function run(profile: ProfileId, x: Float32Array) {
  const p = PROFILES[profile];
  const det = new ChordDetector(SR);
  det.applyProfile(p);
  det.manualGate = 0.001;
  const rb = new RingBuffer(1 << 15);
  const shown: { t: number; id: string | null }[] = [];
  const block = 128;
  let nextAnalysis = 0;
  for (let i = 0; i < x.length; i += block) {
    rb.write(x.subarray(i, i + block), i);
    const tMs = (i / SR) * 1000;
    if (tMs >= nextAnalysis) {
      nextAnalysis += p.intervalMs;
      const r = det.step(rb, tMs);
      const id = r.state.current ? chordId(r.state.current) : null;
      if (!shown.length || shown[shown.length - 1]!.id !== id) shown.push({ t: tMs, id });
    }
  }
  return shown;
}

/** Délai entre le début de l'accord et son affichage. */
function latency(shown: { t: number; id: string | null }[], id: string, start: number): number {
  const s = shown.find((x) => x.id === id && x.t >= start);
  return s ? s.t - start : Infinity;
}

describe('profils de réactivité — mesures (signaux synthétiques)', () => {
  const seq = [
    { c: chord(0), dur: 1.5 },
    { c: chord(7), dur: 1.5 },
    { c: chord(9, 'min'), dur: 1.5 },
  ];
  const clean = stream(seq, 0.004);
  const results: Record<string, { latencies: number[]; changes: number }> = {};

  it('signal propre : les 3 profils reconnaissent C → G → Am sans erreur', () => {
    for (const id of PROFILE_IDS) {
      const shown = run(id, clean);
      expect(shown.map((s) => s.id).filter((x) => x !== null), id).toEqual(['0:maj', '7:maj', '9:min']);
      results[id] = { latencies: [latency(shown, '0:maj', 0), latency(shown, '7:maj', 1500), latency(shown, '9:min', 3000)], changes: 0 };
    }
  });

  it('délai d’affichage : RAPIDE < ÉQUILIBRÉ < STABLE, et RAPIDE sous 450 ms', () => {
    const avg = (id: ProfileId) => results[id]!.latencies.reduce((a, b) => a + b, 0) / 3;
    expect(avg('fast')).toBeLessThan(avg('balanced'));
    expect(avg('balanced')).toBeLessThan(avg('stable'));
    expect(Math.max(...results.fast!.latencies)).toBeLessThan(450);
    expect(Math.max(...results.stable!.latencies)).toBeLessThan(1200);
    // Valeurs reportées dans docs/ROADMAP-MUSIC-ADVENTURE.md
    console.log('MESURE latences (ms)', PROFILE_IDS.map((id) => `${id}=${results[id]!.latencies.map(Math.round).join('/')}`).join('  '));
  });

  it('fluctuation rapide (arpège qui oscille Am/C toutes les 250 ms) : RAPIDE suit, ÉQUILIBRÉ et STABLE tiennent', () => {
    const alt = stream(Array.from({ length: 16 }, (_, i) => ({ c: i % 2 ? chord(0) : chord(9, 'min'), dur: 0.25 })), 0.01, false, 4);
    const n = Object.fromEntries(PROFILE_IDS.map((id) => [id, run(id, alt).length]));
    console.log('MESURE changements d’affichage sur oscillation', JSON.stringify(n));
    expect(n.fast!).toBeGreaterThanOrEqual(8);
    expect(n.balanced!).toBeLessThanOrEqual(2);
    expect(n.stable!).toBeLessThanOrEqual(2);
  });

  it('bruit fort avec rafales : les 3 profils affichent l’accord, sans changement parasite', () => {
    const noisy = stream([{ c: chord(9, 'min'), dur: 6 }], 0.09, true, 11, 0.45);
    for (const id of PROFILE_IDS) {
      const shown = run(id, noisy);
      const first = shown.findIndex((s) => s.id === '9:min');
      expect(first, id).toBeGreaterThanOrEqual(0);
      // Au plus 1 changement après : l'extinction naturelle de l'accord en fin de flux.
      expect(shown.length - 1 - first, id).toBeLessThanOrEqual(1);
    }
  });
});

describe('calibration guidée', () => {
  const frames = (rms: number, conf: number, n = 30, jitter = 0.1) => Array.from({ length: n }, (_, i) => ({ rms: rms * (1 + jitter * Math.sin(i)), confidence: conf }));
  it('interface audio, pièce calme : qualité bonne → profil RAPIDE', async () => {
    const { analyzeCalibration } = await import('../src/detection/calibration');
    const r = analyzeCalibration(frames(0.0008, 0), frames(0.08, 0.85));
    expect(r.quality).toBe('good');
    expect(r.profile).toBe('fast');
    expect(r.snrDb).toBeGreaterThan(30);
    expect(r.advice).toEqual(['allGood']);
  });
  it('micro de téléphone, pièce bruyante : profil STABLE et conseils', async () => {
    const { analyzeCalibration } = await import('../src/detection/calibration');
    const r = analyzeCalibration(frames(0.01, 0), frames(0.04, 0.4));
    expect(r.quality).toBe('poor');
    expect(r.profile).toBe('stable');
    expect(r.advice).toEqual(expect.arrayContaining(['noisyRoom', 'unclearChord', 'tryInterface']));
  });
  it('compromis : profil ÉQUILIBRÉ', async () => {
    const { analyzeCalibration } = await import('../src/detection/calibration');
    expect(analyzeCalibration(frames(0.004, 0), frames(0.04, 0.6)).profile).toBe('balanced');
  });
  it('trop faible (guitare non jouée) ou saturé : signalé', async () => {
    const { analyzeCalibration } = await import('../src/detection/calibration');
    expect(analyzeCalibration(frames(0.001, 0), frames(0.0012, 0.1)).advice).toContain('tooQuiet');
    expect(analyzeCalibration(frames(0.001, 0), frames(0.7, 0.8)).advice).toContain('clipping');
  });
  it('la sensibilité recommandée place le seuil juste au-dessus du bruit mesuré', async () => {
    const { analyzeCalibration } = await import('../src/detection/calibration');
    const { noiseGateFor } = await import('../src/ui/settings');
    const r = analyzeCalibration(frames(0.004, 0), frames(0.05, 0.7));
    const gate = noiseGateFor(r.sensitivity);
    expect(gate).toBeGreaterThan(0.004 * 1.5);
    expect(gate).toBeLessThan(0.05 / 3);
  });
});
