import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { celebratePose, hopPose, idlePose, jumpPoint } from '../src/mascot/animator';
import { contrastRatio, worldForStyle, WORLD_IDS, WORLDS } from '../src/themes/themes';
import { STYLES } from '../src/theory/harmony';

const M = { hop: 40, squash: 0.2, sway: 6 };

describe('mascotte — mouvements calés sur le temps', () => {
  it('sur le temps (phase 0) : au sol, écrasement maximal (l’impact tombe sur le temps)', () => {
    const p = hopPose(0, false, 0, M);
    expect(p.y).toBe(0);
    expect(p.sy).toBeCloseTo(1 - M.squash);
    expect(p.sx).toBeGreaterThan(1);
  });
  it('juste avant le temps suivant : retombe exactement au sol', () => {
    expect(Math.abs(hopPose(0.9999, false, 0, M).y)).toBeLessThan(0.05);
    expect(hopPose(1, false, 0, M).y).toBeCloseTo(0, 6);
  });
  it('au milieu de l’envol : au plus haut ; plus haut avant le temps 1 (accent)', () => {
    expect(hopPose(0.75, false, 0, M).y).toBeCloseTo(-M.hop);
    expect(hopPose(0.75, true, 0, M).y).toBeCloseTo(-M.hop * 1.4);
  });
  it('phase hors limites : bornée (jamais de saut erratique si l’horloge saute)', () => {
    expect(hopPose(-3, false, 0, M)).toEqual(hopPose(0, false, 0, M));
    expect(hopPose(7, false, 0, M).y).toBeCloseTo(0, 6);
  });
  it('balancement alterné d’un temps à l’autre (swing)', () => {
    expect(Math.sign(hopPose(0.5, false, 0, M).rot)).toBe(-Math.sign(hopPose(0.5, false, 1, M).rot));
  });
  it('saut d’îlot en îlot : part du point de départ, arrive au point d’arrivée', () => {
    expect(jumpPoint(0, 10, 20, 300, 80, 100)).toEqual({ x: 10, y: 20 });
    const end = jumpPoint(1, 10, 20, 300, 80, 100);
    expect(end.x).toBeCloseTo(300);
    expect(end.y).toBeCloseTo(80);
    expect(jumpPoint(0.5, 0, 0, 100, 0, 100).y).toBeCloseTo(-100);
  });
  it('repos et célébration : bornés', () => {
    for (let t = 0; t < 5; t += 0.1) expect(Math.abs(idlePose(t).sy - 1)).toBeLessThan(0.03);
    expect(celebratePose(1, M).rot).toBe(360);
    expect(celebratePose(0, M).y).toBeCloseTo(0);
  });
});

describe('mondes — thèmes', () => {
  it('six mondes, chacun avec palette, particules, mouvement, costume et limites de performance', () => {
    expect(WORLD_IDS).toEqual(['blues', 'rock', 'folk', 'country', 'jazz', 'pop']);
    const costumes = new Set(WORLD_IDS.map((id) => WORLDS[id].costume));
    expect(costumes.size).toBe(6);
    const particles = new Set(WORLD_IDS.map((id) => WORLDS[id].particles.kind));
    expect(particles.size).toBe(6);
    for (const id of WORLD_IDS) expect(WORLDS[id].particles.count).toBeLessThanOrEqual(WORLDS[id].performance.maxParticles);
  });
  it('les mondes ont des caractères d’animation réellement différents', () => {
    const sig = WORLD_IDS.map((id) => JSON.stringify(WORLDS[id].motion));
    expect(new Set(sig).size).toBe(6);
    expect(WORLDS.rock.motion.hop).toBeGreaterThan(WORLDS.folk.motion.hop); // énergique vs apaisant
    expect(WORLDS.blues.motion.sway).toBeGreaterThan(0); // swing
    expect(WORLDS.rock.motion.sway).toBe(0); // percussif
  });
  it('contraste : texte des boutons d’accent ≥ 4,5:1, étiquettes d’îlots ≥ 4,5:1 sur leur dessus', () => {
    for (const id of WORLD_IDS) {
      const th = WORLDS[id];
      expect(contrastRatio(th.tokens.accent, th.tokens.accentText), `${id} accent`).toBeGreaterThanOrEqual(4.5);
      for (const top of th.palette.islandTop) expect(contrastRatio(th.palette.label, top), `${id} îlot`).toBeGreaterThanOrEqual(4.5);
      // Nom de l'accord central : blanc cerné de noir sur le flanc de l'îlot.
      expect(contrastRatio('#ffffff', th.palette.islandSide), `${id} flanc`).toBeGreaterThanOrEqual(3);
    }
  });
  it('chaque style d’accompagnement a son monde', () => {
    for (const st of STYLES) expect(worldForStyle(st)).toBe(st);
    expect(worldForStyle('inconnu')).toBe('blues');
  });
});

describe('architecture — les visuels ne touchent jamais au moteur audio', () => {
  const imports = (dir: string) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => `${f}: ${m[1]}`));
  it('themes/ ne dépend d’aucun module musical ni audio', () => {
    expect(imports('src/themes').filter((i) => /\.\.\/(audio|metronome|detection|accompaniment|theory|suggestions|instruments|ui)\b/.test(i))).toEqual([]);
  });
  it('mascot/ ne dépend que du rendu et des thèmes (aucun accès à l’horloge audio)', () => {
    expect(imports('src/mascot').filter((i) => /\.\.\/(audio|metronome|detection|accompaniment|ui)\b/.test(i))).toEqual([]);
    for (const f of readdirSync('src/mascot')) expect(readFileSync(join('src/mascot', f), 'utf8')).not.toMatch(/AudioContext|currentTime/);
  });
});
