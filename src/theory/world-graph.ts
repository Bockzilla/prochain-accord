import { chord, chordId, commonTones, isMinorish, sameChord, type Chord, type ChordQuality } from './chords';
import { diatonicTriads } from './harmony';
import type { Key } from './keys';
import { mod12 } from './notes';

/**
 * Univers harmonique — graphe PUR, cyclique et sans fin : chaque accord a des voisins calculés
 * à la demande. On n'en matérialise qu'une fenêtre bornée autour de l'accord courant.
 * Chaque chemin est justifié par une relation musicale nommée.
 */
export type EdgeKind = 'resolution' | 'dominant' | 'diatonic' | 'relative' | 'commonTones' | 'borrowed' | 'modulation';

export const EDGE_KINDS: EdgeKind[] = ['resolution', 'dominant', 'diatonic', 'relative', 'commonTones', 'borrowed', 'modulation'];

export interface WorldEdge {
  from: Chord;
  to: Chord;
  kind: EdgeKind;
  /** Tonalité de référence APRÈS avoir pris ce chemin (change pour une modulation). */
  key: Key;
  /** Notes communes entre les deux accords. */
  shared: number;
}

/** Direction de chaque type de chemin dans le monde (radians, 0 = droite) : le monde reste lisible. */
export const EDGE_DIRECTION: Record<EdgeKind, number> = {
  resolution: Math.PI, // ← vers la gauche : on « rentre »
  dominant: 0, // → vers la droite : on prépare
  diatonic: -Math.PI / 2, // ↑ vers le haut : dans la tonalité
  relative: Math.PI / 2, // ↓ vers le bas : le relatif
  commonTones: (-3 * Math.PI) / 4, // ↖
  borrowed: (3 * Math.PI) / 4, // ↙
  modulation: Math.PI / 4, // ↘ : vers une autre tonalité
};

const PRIORITY: Record<EdgeKind, number> = { resolution: 0, dominant: 1, relative: 2, diatonic: 3, commonTones: 4, borrowed: 5, modulation: 6 };

function inKey(c: Chord, key: Key): Chord | null {
  return diatonicTriads(key).find((d) => d.chord.root === mod12(c.root))?.chord ?? null;
}

function triadOf(root: number, key: Key, fallback: ChordQuality): Chord {
  return inKey(chord(root), key) ?? chord(root, fallback);
}

/** Voisins d'un accord dans une tonalité de référence (au plus 8, sans doublon). */
export function neighbors(c: Chord, key: Key): WorldEdge[] {
  const out: WorldEdge[] = [];
  const add = (to: Chord, kind: EdgeKind, nextKey: Key = key) => {
    if (sameChord(to, c)) return;
    out.push({ from: c, to, kind, key: nextKey, shared: commonTones(c, to) });
  };
  const majorish = !isMinorish(c.quality);

  // Résolution : un accord majeur / de 7e « tombe » une quinte plus bas (V → I).
  if (majorish) add(triadOf(c.root + 5, key, 'maj'), 'resolution');
  // Dominante : l'accord qui prépare c (sa dominante, en 7e).
  add(chord(c.root + 7, '7'), 'dominant');
  // Relatif : mêmes notes à une près (C ↔ Am).
  add(majorish ? chord(c.root + 9, 'min') : chord(c.root + 3, 'maj'), 'relative');
  // Diatoniques : accords de la tonalité à une quarte ou une tierce de distance.
  for (const d of diatonicTriads(key)) {
    const iv = mod12(d.chord.root - c.root);
    if (d.chord.quality !== 'dim' && (iv === 5 || iv === 3 || iv === 4 || iv === 8 || iv === 9)) add(d.chord, 'diatonic');
  }
  // Notes communes : deux notes partagées, hors relatif (C → Em, Am → F).
  add(majorish ? chord(c.root + 4, 'min') : chord(c.root + 8, 'maj'), 'commonTones');
  // Emprunts au mode parallèle : ♭VII et iv d'une tonalité majeure, IV d'une mineure.
  if (key.mode === 'major') {
    add(chord(key.tonic + 10, 'maj'), 'borrowed');
    add(chord(key.tonic + 5, 'min'), 'borrowed');
  } else {
    add(chord(key.tonic + 5, 'maj'), 'borrowed');
  }
  // Modulations par accord pivot : la dominante (7e) d'une tonalité voisine.
  const up: Key = { tonic: mod12(key.tonic + 7), mode: key.mode };
  const down: Key = { tonic: mod12(key.tonic + 5), mode: key.mode };
  add(chord(up.tonic + 7, '7'), 'modulation', up);
  add(chord(down.tonic + 7, '7'), 'modulation', down);

  // Dédoublonnage (on garde la relation la plus forte), puis au plus 8 chemins.
  const best = new Map<string, WorldEdge>();
  for (const e of out) {
    const id = chordId(e.to);
    const prev = best.get(id);
    if (!prev || PRIORITY[e.kind] < PRIORITY[prev.kind]) best.set(id, e);
  }
  return [...best.values()].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]).slice(0, 8);
}

export interface WorldNode {
  chord: Chord;
  /** Position dans le plan du monde (unités arbitraires). */
  x: number;
  y: number;
  ring: 0 | 1 | 2;
  edge: WorldEdge | null;
}

/**
 * Fenêtre visible du monde : l'accord courant, ses voisins (anneau 1) et un aperçu
 * des voisins suivants (anneau 2, 2 par voisin). Taille bornée : au plus 1 + 8 + 10 nœuds.
 */
export function worldWindow(center: Chord, key: Key): { nodes: WorldNode[]; edges: WorldEdge[] } {
  const ring1 = neighbors(center, key);
  const nodes: WorldNode[] = [{ chord: center, x: 0, y: 0, ring: 0, edge: null }];
  const edges: WorldEdge[] = [...ring1];
  // Placement : créneaux réguliers autour du centre ; chaque chemin prend le créneau libre
  // le plus proche de la direction de son type (les relations gardent leur orientation).
  const R1 = 1;
  const nSlots = Math.max(6, ring1.length);
  // Décalage d'un demi-créneau : aucun îlot juste au-dessus du centre (la mascotte le cacherait).
  const slots = Array.from({ length: nSlots }, (_, k) => -Math.PI / 2 + Math.PI / nSlots + (k * 2 * Math.PI) / nSlots);
  const used = new Set<number>();
  const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (const e of ring1) {
    let best = -1;
    for (let k = 0; k < nSlots; k++) {
      if (used.has(k)) continue;
      if (best < 0 || angDist(slots[k]!, EDGE_DIRECTION[e.kind]) < angDist(slots[best]!, EDGE_DIRECTION[e.kind])) best = k;
    }
    used.add(best);
    const a = slots[best]!;
    nodes.push({ chord: e.to, x: Math.cos(a) * R1, y: Math.sin(a) * R1, ring: 1, edge: e });
  }
  const seen = new Set(nodes.map((n) => chordId(n.chord)));
  let ring2 = 0;
  for (const n of nodes.filter((x) => x.ring === 1)) {
    const nk = n.edge!.key;
    const next = neighbors(n.chord, nk).filter((e) => !seen.has(chordId(e.to))).slice(0, 2);
    for (const e of next) {
      if (ring2 >= 10) break;
      // Cherche une place libre près du voisin, en s'éloignant du centre.
      const base = Math.atan2(n.y, n.x);
      const tries = [-0.4, 0.4, -0.8, 0.8, 0, -1.2, 1.2];
      for (const da of tries) {
        for (const dist of [0.62, 0.8]) {
          const x = n.x + Math.cos(base + da) * dist;
          const y = n.y + Math.sin(base + da) * dist;
          // Reste dans la zone visible du monde, sans toucher un autre îlot.
          if (Math.abs(x) <= 1.5 && Math.abs(y) <= 1.55 && nodes.every((m) => Math.hypot(m.x - x, m.y - y) > 0.36)) {
            nodes.push({ chord: e.to, x, y, ring: 2, edge: e });
            edges.push(e);
            seen.add(chordId(e.to));
            ring2++;
            break;
          }
        }
        if (seen.has(chordId(e.to))) break;
      }
    }
  }
  return { nodes, edges };
}
