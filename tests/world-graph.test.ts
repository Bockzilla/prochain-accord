import { describe, expect, it } from 'vitest';
import { chord, chordId, chordPitchClasses, isMinorish, type Chord } from '../src/theory/chords';
import { diatonicTriads } from '../src/theory/harmony';
import type { Key } from '../src/theory/keys';
import { mod12 } from '../src/theory/notes';
import { neighbors, worldWindow } from '../src/theory/world-graph';

const C: Key = { tonic: 0, mode: 'major' };
const Am: Key = { tonic: 9, mode: 'minor' };
const allChords: Chord[] = [];
for (let r = 0; r < 12; r++) for (const q of ['maj', 'min', '7'] as const) allChords.push(chord(r, q));
const allKeys: Key[] = [];
for (let t = 0; t < 12; t++) for (const mode of ['major', 'minor'] as const) allKeys.push({ tonic: t, mode });

describe('univers harmonique — chaque chemin est justifié', () => {
  it('pour tout accord et toute tonalité : la relation annoncée est exacte', () => {
    for (const key of allKeys)
      for (const c of allChords)
        for (const e of neighbors(c, key)) {
          const iv = mod12(e.to.root - c.root);
          const tag = `${chordId(c)} → ${chordId(e.to)} (${e.kind}) en ${key.tonic}${key.mode}`;
          switch (e.kind) {
            case 'resolution':
              expect(iv, tag).toBe(5);
              expect(isMinorish(c.quality), tag).toBe(false);
              break;
            case 'dominant':
              expect(iv, tag).toBe(7);
              expect(e.to.quality, tag).toBe('7');
              break;
            case 'relative':
              expect(e.shared, tag).toBe(2);
              expect(iv, tag).toBe(isMinorish(c.quality) ? 3 : 9);
              break;
            case 'diatonic':
              expect(diatonicTriads(key).some((d) => chordId(d.chord) === chordId(e.to)), tag).toBe(true);
              break;
            case 'commonTones':
              expect(e.shared, tag).toBeGreaterThanOrEqual(2);
              break;
            case 'borrowed': {
              // Emprunt = accord du mode parallèle, absent de la tonalité.
              const parallel: Key = { tonic: key.tonic, mode: key.mode === 'major' ? 'minor' : 'major' };
              expect(diatonicTriads(parallel).some((d) => chordId(d.chord) === chordId(e.to)), tag).toBe(true);
              expect(diatonicTriads(key).some((d) => chordId(d.chord) === chordId(e.to)), tag).toBe(false);
              break;
            }
            case 'modulation': {
              // Accord pivot : dominante (7e) d'une tonalité voisine d'une quinte, qui devient la nouvelle référence.
              expect(e.to.quality, tag).toBe('7');
              expect(mod12(e.to.root - e.key.tonic), tag).toBe(7);
              expect([5, 7]).toContain(mod12(e.key.tonic - key.tonic));
              break;
            }
          }
          expect(e.shared).toBe(chordPitchClasses(c).filter((p) => chordPitchClasses(e.to).includes(p)).length);
        }
  });
  it('pas de boucle sur soi-même, pas de doublon, au plus 8 voisins', () => {
    for (const key of allKeys)
      for (const c of allChords) {
        const ns = neighbors(c, key);
        expect(ns.length).toBeGreaterThanOrEqual(5);
        expect(ns.length).toBeLessThanOrEqual(8);
        const ids = ns.map((e) => chordId(e.to));
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain(chordId(c));
      }
  });
  it('exemples : en Do, G → C est une résolution, C → Am le relatif, C → G7 la dominante', () => {
    const fromG = neighbors(chord(7), C);
    expect(fromG.find((e) => chordId(e.to) === '0:maj')?.kind).toBe('resolution');
    const fromC = neighbors(chord(0), C);
    expect(fromC.find((e) => chordId(e.to) === '9:min')?.kind).toBe('relative');
    expect(fromC.find((e) => chordId(e.to) === '7:7')?.kind).toBe('dominant');
    expect(fromC.find((e) => chordId(e.to) === '10:maj')?.kind).toBe('borrowed');
  });
});

describe('univers harmonique — structure', () => {
  it('cyclique : on peut toujours revenir à l’accord de départ', () => {
    for (const start of [chord(0), chord(9, 'min'), chord(4, '7')]) {
      let frontier = neighbors(start, C).map((e) => ({ c: e.to, k: e.key }));
      let back = false;
      for (let depth = 0; depth < 3 && !back; depth++) {
        back = frontier.some((f) => neighbors(f.c, f.k).some((e) => chordId(e.to) === chordId(start)));
        frontier = frontier.flatMap((f) => neighbors(f.c, f.k).map((e) => ({ c: e.to, k: e.key }))).slice(0, 200);
      }
      expect(back, chordId(start)).toBe(true);
    }
  });
  it('sans fin : depuis Do, l’exploration atteint les 12 tonalités majeures et mineures', () => {
    const seen = new Set<string>();
    let frontier = [{ c: chord(0), k: C }];
    for (let depth = 0; depth < 8; depth++) {
      const next: typeof frontier = [];
      for (const f of frontier)
        for (const e of neighbors(f.c, f.k)) {
          const id = chordId(e.to) + `|${e.key.tonic}${e.key.mode}`;
          if (seen.has(id)) continue;
          seen.add(id);
          next.push({ c: e.to, k: e.key });
        }
      frontier = next;
    }
    const roots = new Set([...seen].map((s) => s.split(':')[0]));
    expect(roots.size).toBe(12);
    const keys = new Set([...seen].map((s) => s.split('|')[1]));
    expect(keys.size).toBe(12); // les modulations font le tour du cercle des quintes
  });
  it('fenêtre bornée : au plus 19 îlots, positions distinctes, centre au milieu', () => {
    for (const key of [C, Am])
      for (const c of allChords) {
        const w = worldWindow(c, key);
        expect(w.nodes.length).toBeLessThanOrEqual(19);
        expect(w.nodes[0]).toMatchObject({ x: 0, y: 0, ring: 0 });
        const ids = w.nodes.map((n) => chordId(n.chord));
        expect(new Set(ids).size).toBe(ids.length);
        // Aucun îlot ne se superpose à un autre (distance minimale)
        for (let i = 0; i < w.nodes.length; i++)
          for (let j = i + 1; j < w.nodes.length; j++) {
            const a = w.nodes[i]!;
            const b = w.nodes[j]!;
            expect(Math.hypot(a.x - b.x, a.y - b.y), `${ids[i]} / ${ids[j]}`).toBeGreaterThan(0.25);
          }
      }
  });
  it('déterministe : même entrée, même monde', () => {
    expect(JSON.stringify(worldWindow(chord(7), C))).toBe(JSON.stringify(worldWindow(chord(7), C)));
  });
});
