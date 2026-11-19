import { describe, expect, it } from 'vitest';
import { yinPitch } from '../src/detection/pitch';
import { combRemove, TunerStabilizer, tunerPitch } from '../src/detection/tuner';
import { midiToFreq } from '../src/theory/notes';

/**
 * Accordeur en situation réelle : on change de corde pendant que la précédente sonne encore.
 * Rapport utilisateur (2026-11-19, vraie guitare) : en mode Guitare, « quand tu changes de note,
 * il reste à vouloir accorder la même note ».
 */
const SR = 48000;
const TICK = 0.045; // cadence de l'accordeur (tuner-view.ts)

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

/** Corde pincée : 8 harmoniques légèrement inharmoniques, aigus qui s'éteignent plus vite, attaque bruitée. */
function pluck(x: Float32Array, midi: number, start: number, amp: number, decay: number, seed: number, glideCents = 0, glideSec = 1) {
  const r = rng(seed);
  const harm = [0.5, 1, 0.7, 0.45, 0.3, 0.2, 0.12, 0.08];
  const s0 = Math.round(start * SR);
  harm.forEach((a, k) => {
    let ph = Math.abs(r()) * 6.28;
    const d = decay / (1 + 0.4 * k);
    const inh = Math.sqrt(1 + 0.0001 * (k + 1) ** 2);
    for (let i = s0; i < x.length; i++) {
      const t = (i - s0) / SR;
      const cents = glideCents * (1 - Math.min(1, t / glideSec));
      ph += (2 * Math.PI * midiToFreq(midi + cents / 100) * (k + 1) * inh) / SR;
      x[i]! += amp * a * Math.exp(-t / d) * Math.sin(ph);
    }
  });
  for (let i = s0; i < Math.min(x.length, s0 + 0.03 * SR); i++) x[i]! += amp * 0.6 * r();
}

interface Pluck {
  midi: number;
  at: number;
  amp?: number;
  glide?: number;
}

/** Joue la séquence et renvoie, à chaque mesure de l'accordeur, la corde visée (null = rien d'affiché). */
function run(plucks: Pluck[], dur: number, decay = 2): { t: number; target: number | null; cents: number; stable: boolean }[] {
  const x = new Float32Array(Math.round(dur * SR));
  plucks.forEach((p, i) => pluck(x, p.midi, p.at, p.amp ?? 0.1, decay, i + 1, p.glide ?? 0, 2));
  const r = rng(99);
  for (let i = 0; i < x.length; i++) x[i]! += 0.002 * r();
  const st = new TunerStabilizer('guitar');
  const out = [];
  for (let t = 0.2; t < dur; t += TICK) {
    const end = Math.round(t * SR);
    const rd = st.update(tunerPitch(x.subarray(end - 4096, end), SR, st.ringing));
    out.push({ t, target: rd?.target ?? null, cents: rd?.cents ?? 0, stable: !!rd?.stable });
  }
  return out;
}

/** Entre `from` et `to` : jamais une autre corde, et la bonne corde affichée la plupart du temps. */
function expectSegment(rs: ReturnType<typeof run>, from: number, to: number, midi: number, minShare = 0.8) {
  const seg = rs.filter((r) => r.t >= from && r.t < to);
  const wrong = seg.filter((r) => r.target !== null && r.target !== midi);
  expect(wrong.map((r) => `${r.t.toFixed(2)} s → ${r.target}`), `segment ${from}–${to} s, corde ${midi}`).toEqual([]);
  const ok = seg.filter((r) => r.target === midi && r.stable).length / seg.length;
  expect(ok, `segment ${from}–${to} s, part affichée`).toBeGreaterThanOrEqual(minShare);
}

describe('accordeur : changer de corde pendant que la précédente sonne', () => {
  it('le peigne retire une note et ses harmoniques, et garde l’autre périodique', () => {
    const x = new Float32Array(4096);
    const y = new Float32Array(4096);
    pluck(x, 40, 0, 0.1, 5, 1);
    pluck(y, 45, 0, 0.1, 5, 2);
    const mix = x.map((v, i) => v + y[i]!);
    expect(yinPitch(mix, SR)!.clarity).toBeLessThan(0.85); // le mélange seul est rejeté (cause du bug)
    const p = yinPitch(combRemove(mix, SR, midiToFreq(40))!, SR)!;
    expect(Math.abs(1200 * Math.log2(p.freq / midiToFreq(45)))).toBeLessThan(10);
    expect(p.clarity).toBeGreaterThan(0.85);
  });

  it('Mi grave qui sonne fort, puis La pincé doucement : l’accordeur passe au La en moins de 0,3 s', () => {
    const rs = run([{ midi: 40, at: 0.1 }, { midi: 45, at: 1.5, amp: 0.04 }], 4, 3);
    expectSegment(rs, 0.4, 1.5, 40);
    expectSegment(rs, 1.8, 4, 45, 0.9);
  });

  it('La puis Ré doux', () => {
    const rs = run([{ midi: 45, at: 0.1 }, { midi: 50, at: 1.5, amp: 0.04 }], 4, 3);
    expectSegment(rs, 1.8, 4, 50, 0.9);
  });

  it('retour sur une corde déjà accordée (Mi, La, puis Mi repincé)', () => {
    const rs = run([{ midi: 40, at: 0.1 }, { midi: 45, at: 1.5, amp: 0.07 }, { midi: 40, at: 3, amp: 0.08 }], 4.5, 3);
    expectSegment(rs, 1.8, 3, 45, 0.85);
    expectSegment(rs, 3.3, 4.5, 40, 0.85);
  });

  it('les 6 cordes dans l’ordre, chacune laissée sonner (3 s par corde)', () => {
    const strings = [40, 45, 50, 55, 59, 64];
    const rs = run(strings.map((m, i) => ({ midi: m, at: 0.1 + 3 * i })), 18.5, 2);
    strings.forEach((m, i) => expectSegment(rs, 0.4 + 3 * i, 0.1 + 3 * (i + 1), m, 0.9));
  });

  it('cas extrême : 6 cordes enchaînées toutes les 1,5 s, toutes encore sonores', () => {
    const strings = [40, 45, 50, 55, 59, 64];
    const rs = run(strings.map((m, i) => ({ midi: m, at: 0.1 + 1.5 * i })), 9.6, 3);
    strings.forEach((m, i) => expectSegment(rs, 0.4 + 1.5 * i, 0.1 + 1.5 * (i + 1), m, 0.75));
  });

  it('Si puis Mi aigu : pas de « Mi grave fantôme » (Si3 + Mi4 se répètent comme un Mi2)', () => {
    const rs = run([{ midi: 59, at: 0.1 }, { midi: 64, at: 1.5 }], 4, 3);
    expect(rs.filter((r) => r.target === 40)).toEqual([]);
    expectSegment(rs, 1.8, 4, 64, 0.9);
  });

  it('on tourne la clé : La pincé à −80 cents, remonté à 0 en 2 s, pendant que le Mi sonne', () => {
    const rs = run([{ midi: 40, at: 0.1 }, { midi: 45, at: 1.5, glide: -80 }], 5, 3);
    expectSegment(rs, 1.8, 5, 45, 0.9);
    const end = rs.filter((r) => r.t > 3.8);
    for (const r of end) expect(Math.abs(r.cents)).toBeLessThan(5);
    const early = rs.find((r) => r.t > 1.8 && r.t < 2)!;
    expect(early.cents).toBeLessThan(-50); // l'aiguille suit bien le désaccord réel
  });

  it('un accord gratté juste après avoir accordé le La reste rejeté', () => {
    const rs = run([{ midi: 45, at: 0.1 }, { midi: 45, at: 1.5, amp: 0.08 }, { midi: 49, at: 1.5, amp: 0.08 }, { midi: 52, at: 1.5, amp: 0.08 }, { midi: 57, at: 1.5, amp: 0.06 }], 4, 3);
    expect(rs.filter((r) => r.t > 1.6 && r.stable)).toEqual([]);
  });
});
