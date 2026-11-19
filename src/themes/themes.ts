/**
 * Moteur de thèmes — définitions des mondes. AUCUNE dépendance musicale :
 * un thème ne connaît ni accords, ni tempo, ni audio. Le lien style → monde est fait par l'interface.
 */
export type WorldId = 'blues' | 'rock' | 'folk' | 'country' | 'jazz' | 'pop';
export const WORLD_IDS: WorldId[] = ['blues', 'rock', 'folk', 'country', 'jazz', 'pop'];

export type ParticleKind = 'smoke' | 'sparks' | 'fireflies' | 'dust' | 'glints' | 'confetti';
export type CostumeId = 'fedora' | 'stage' | 'scarf' | 'cowboy' | 'suit' | 'shades';

export interface WorldTheme {
  id: WorldId;
  /** Design tokens appliqués à l'interface (variables CSS). Contraste vérifié par test. */
  tokens: {
    accent: string;
    accentText: string;
    worldBg: string;
  };
  palette: {
    sky: [string, string, string];
    ground: string;
    islandTop: [string, string];
    islandSide: string;
    islandRim: string;
    label: string;
    path: string;
    glow: string;
  };
  particles: { kind: ParticleKind; count: number; colors: string[]; speed: number };
  /** Caractère des animations de la mascotte. */
  motion: {
    /** Hauteur du saut (unités du monde). */
    hop: number;
    /** Écrasement à la réception (0..0.3). */
    squash: number;
    /** Balancement latéral (swing) en degrés. */
    sway: number;
    /** Courbe d'accélération CSS des transitions. */
    easing: string;
  };
  costume: CostumeId;
  /** Paramètres de performance : nombre maximal de particules, flou autorisé. */
  performance: { maxParticles: number; blur: boolean };
}

export const WORLDS: Record<WorldId, WorldTheme> = {
  blues: {
    id: 'blues',
    tokens: { accent: '#ffb340', accentText: '#1a1100', worldBg: '#0b1630' },
    palette: {
      sky: ['#050b1f', '#0e1f4a', '#1b3570'],
      ground: '#081127',
      islandTop: ['#2c4a8f', '#1a2e63'],
      islandSide: '#0f1d42',
      islandRim: '#ffb340',
      label: '#fff4dc',
      path: '#ffcf7a',
      glow: '#ffb340',
    },
    particles: { kind: 'smoke', count: 18, colors: ['#9fb3e8', '#c9d4f5'], speed: 0.25 },
    motion: { hop: 34, squash: 0.12, sway: 7, easing: 'cubic-bezier(.45,.05,.35,1)' },
    costume: 'fedora',
    performance: { maxParticles: 22, blur: true },
  },
  rock: {
    id: 'rock',
    tokens: { accent: '#ff3b4a', accentText: '#1a0004', worldBg: '#16151a' },
    palette: {
      sky: ['#0d0c10', '#1d1b22', '#2c2830'],
      ground: '#0c0b0e',
      islandTop: ['#3b3843', '#25232b'],
      islandSide: '#141217',
      islandRim: '#ff3b4a',
      label: '#ffffff',
      path: '#ff6b74',
      glow: '#ff3b4a',
    },
    particles: { kind: 'sparks', count: 26, colors: ['#ff6a3d', '#ffd23f', '#ff3b4a'], speed: 1.4 },
    motion: { hop: 46, squash: 0.24, sway: 0, easing: 'cubic-bezier(.2,.9,.3,1.2)' },
    costume: 'stage',
    performance: { maxParticles: 30, blur: false },
  },
  folk: {
    id: 'folk',
    tokens: { accent: '#9cc788', accentText: '#10200a', worldBg: '#1d2b22' },
    palette: {
      sky: ['#1b2c26', '#355246', '#6f8f6e'],
      ground: '#203328',
      islandTop: ['#8db376', '#71a063'],
      islandSide: '#6b4a2f',
      islandRim: '#e8d3a3',
      label: '#16230f',
      path: '#e8d3a3',
      glow: '#ffd27a',
    },
    particles: { kind: 'fireflies', count: 16, colors: ['#e9ff9a', '#ffe58a'], speed: 0.35 },
    motion: { hop: 28, squash: 0.08, sway: 3, easing: 'cubic-bezier(.4,0,.2,1)' },
    costume: 'scarf',
    performance: { maxParticles: 20, blur: true },
  },
  country: {
    id: 'country',
    tokens: { accent: '#ff9d4d', accentText: '#241000', worldBg: '#2a1621' },
    palette: {
      sky: ['#3b1d4a', '#c2476b', '#ffae5e'],
      ground: '#7a3b26',
      islandTop: ['#f0c98a', '#d9a35d'],
      islandSide: '#a4502f',
      islandRim: '#3f6aa1',
      label: '#3a1a08',
      path: '#ffe1b0',
      glow: '#ffc36b',
    },
    particles: { kind: 'dust', count: 20, colors: ['#ffd9a6', '#f2b77a'], speed: 0.5 },
    motion: { hop: 38, squash: 0.16, sway: 4, easing: 'cubic-bezier(.34,1.56,.64,1)' },
    costume: 'cowboy',
    performance: { maxParticles: 24, blur: false },
  },
  jazz: {
    id: 'jazz',
    tokens: { accent: '#e8c160', accentText: '#1c1200', worldBg: '#1d0f2c' },
    palette: {
      sky: ['#12061f', '#2b1145', '#4a1f6e'],
      ground: '#160a22',
      islandTop: ['#6b3a96', '#45215f'],
      islandSide: '#2a1240',
      islandRim: '#e8c160',
      label: '#fff2cf',
      path: '#e8c160',
      glow: '#e8c160',
    },
    particles: { kind: 'glints', count: 18, colors: ['#ffe39a', '#e8c160'], speed: 0.3 },
    motion: { hop: 26, squash: 0.08, sway: 9, easing: 'cubic-bezier(.65,0,.35,1)' },
    costume: 'suit',
    performance: { maxParticles: 22, blur: true },
  },
  pop: {
    id: 'pop',
    tokens: { accent: '#ff6fb5', accentText: '#2a0018', worldBg: '#2b1f3d' },
    palette: {
      sky: ['#ffd1e8', '#d9c8ff', '#bff2e6'],
      ground: '#c9b8f2',
      islandTop: ['#ffffff', '#ffe0f0'],
      islandSide: '#8e4fae',
      islandRim: '#ff6fb5',
      label: '#3a1240',
      path: '#ff6fb5',
      glow: '#ffffff',
    },
    particles: { kind: 'confetti', count: 24, colors: ['#ff6fb5', '#6fd3ff', '#ffd23f', '#8ef0b0'], speed: 0.9 },
    motion: { hop: 42, squash: 0.2, sway: 0, easing: 'cubic-bezier(.34,1.56,.64,1)' },
    costume: 'shades',
    performance: { maxParticles: 28, blur: false },
  },
};

/** Le monde visuel associé à un style musical (les styles sans monde dédié gardent le blues). */
export function worldForStyle(style: string): WorldId {
  return (WORLD_IDS as string[]).includes(style) ? (style as WorldId) : 'blues';
}

/** Contraste WCAG entre deux couleurs hexadécimales. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}
