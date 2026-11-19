import { t } from '../i18n/i18n';
import { romanPretty } from '../i18n/notation';
import { celebratePose, hopPose, idlePose, jumpPoint, type Pose } from '../mascot/animator';
import { buildMascot, type MascotParts } from '../mascot/mascot-svg';
import type { TickEvent } from '../metronome/scheduler';
import { h, s } from '../render/dom';
import { playChord } from '../synth/chord-player';
import { buildDecor } from '../themes/decor';
import { ParticleLayer } from '../themes/particles';
import type { ThemeEngine } from '../themes/engine';
import type { WorldTheme } from '../themes/themes';
import { chord, chordId, sameChord, type Chord } from '../theory/chords';
import type { Key } from '../theory/keys';
import { romanNumeral } from '../theory/roman';
import { worldWindow, type EdgeKind, type WorldEdge, type WorldNode } from '../theory/world-graph';
import { nameOf, type AppContext } from './context';
import { keyLabel } from './key-picker';
import type { SharedMusic } from './shared';
import { chordPositions } from '../instruments/positions';
import { GUITAR } from '../instruments/model';
import { soundingMidi } from '../instruments/validate';

const TILT = 0.6; // écrasement vertical (2,5D)
/** Petit écran : pas d'anneau extérieur, îlots et textes plus grands. */
const isCompact = () => typeof window !== 'undefined' && window.innerWidth < 640;
const VIEW = { x: -500, y: -340, w: 1000, h: 700 };
const EDGE_ICON: Record<EdgeKind, string> = { resolution: '⌂', dominant: '⚡', diatonic: '♪', relative: '↔', commonTones: '∩', borrowed: '✦', modulation: '⇄' };
const EDGE_DASH: Record<EdgeKind, string> = { resolution: '', dominant: '18 8', diatonic: '', relative: '4 8', commonTones: '2 6', borrowed: '12 6 2 6', modulation: '24 10' };

interface Jump {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Début, en secondes sur l'horloge visuelle (audio − latence) ou performance.now()/1000. */
  start: number;
  dur: number;
  audioClock: boolean;
  edge: WorldEdge | null;
  target: Chord;
  key: Key;
}

/** Monde harmonique explorable + mascotte synchronisée. */
export class WorldView {
  readonly el: HTMLElement;
  private stage = h('div', { class: 'world-stage' });
  private decorSvg = s('svg', { class: 'world-decor', viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
  private scene = s('svg', { class: 'world-scene', viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, role: 'group' });
  private cam = s('g', { class: 'world-cam' });
  private particles = new ParticleLayer();
  private mascot: MascotParts;
  private info = h('div', { class: 'world-info', 'aria-live': 'polite' });
  private trailEl = h('ol', { class: 'world-trail' });
  private center: Chord = chord(9, 'min');
  private key: Key = { tonic: 9, mode: 'minor' };
  private nodes: WorldNode[] = [];
  private trail: { chord: Chord; key: Key }[] = [];
  private lastEdge: WorldEdge | null = null;
  private jump: Jump | null = null;
  private pendingJump: Omit<Jump, 'start' | 'dur' | 'audioClock'> | null = null;
  private celebrateStart = -1;
  private lastBeat: TickEvent | null = null;
  private raf = 0;
  private visible = false;
  private pan = { x: 0, y: 0 };
  private drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;

  constructor(
    private ctx: AppContext,
    private shared: SharedMusic,
    private themes: ThemeEngine,
    /** Horloge visuelle : temps audio moins la latence d'affichage (s). */
    private visualClock: () => number,
    private metroRunning: () => boolean,
  ) {
    this.el = h('div', { class: 'world' });
    this.mascot = buildMascot(themes.current.costume);
    this.stage.append(this.decorSvg, this.particles.canvas, this.scene);
    this.scene.append(this.cam);
    this.scene.setAttribute('aria-label', t('world.title'));
    const back = h('button', { type: 'button', class: 'wbtn', 'aria-label': t('world.back'), text: '↶' });
    const recenter = h('button', { type: 'button', class: 'wbtn', 'aria-label': t('world.recenter'), text: '⌖' });
    const listen = h('button', { type: 'button', class: 'wbtn', 'aria-label': t('world.listen'), text: '♫' });
    back.addEventListener('click', () => this.back());
    recenter.addEventListener('click', () => this.recenter());
    listen.addEventListener('click', () => this.play(this.center));
    const tools = h('div', { class: 'world-tools' }, [back, recenter, listen]);
    this.el.append(h('div', { class: 'world-frame' }, [this.stage, tools]), this.info, this.trailEl);
    this.bindPan();
    let rt: ReturnType<typeof setTimeout> | undefined;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => this.layout(), 200);
    });
    themes.on((th) => this.setTheme(th));
    this.setTheme(themes.current, false);
    this.key = shared.key;
    this.center = shared.key.mode === 'minor' ? chord(shared.key.tonic, 'min') : chord(shared.key.tonic, 'maj');
    this.layout();
  }

  // ------------------------------------------------------------------ thème

  private setTheme(th: WorldTheme, animate = true): void {
    const old = this.decorSvg.querySelector('.decor');
    const next = buildDecor(th);
    if (animate && old) {
      next.classList.add('decor-enter');
      this.decorSvg.append(next);
      setTimeout(() => old.remove(), 750);
    } else {
      this.decorSvg.replaceChildren(next);
    }
    this.particles.setTheme(th);
    this.particles.lowPower = this.ctx.settings.lowPower;
    if (this.visible) this.particles.start();
    // Nouveau costume : on reconstruit la mascotte (même identité, autres accessoires).
    const pos = this.mascot.root.getAttribute('transform');
    this.mascot.root.remove();
    this.mascot = buildMascot(th.costume);
    if (pos) this.mascot.root.setAttribute('transform', pos);
    this.el.dataset.world = th.id;
    this.layout();
  }

  // ------------------------------------------------------------------ disposition

  private toScene(n: { x: number; y: number }): { x: number; y: number; k: number } {
    const k = 1 + n.y * 0.08; // perspective : plus près = plus grand
    const scale = isCompact() ? 330 : 290;
    return { x: n.x * scale, y: n.y * scale * TILT + 30, k };
  }

  private layout(enter = false): void {
    const th = this.themes.current;
    const full = worldWindow(this.center, this.key);
    const compact = isCompact();
    this.el.classList.toggle('compact', compact);
    const nodes = compact ? full.nodes.filter((n) => n.ring < 2) : full.nodes;
    const edges = compact ? full.edges.filter((e) => sameChord(e.from, this.center)) : full.edges;
    this.nodes = nodes;
    const pathsG = s('g', { class: 'w-paths' });
    const islandsG = s('g', { class: 'w-islands' });
    const pos = new Map(nodes.map((n) => [chordId(n.chord), this.toScene(n)]));
    for (const e of edges) {
      const a = pos.get(chordId(e.from));
      const b = pos.get(chordId(e.to));
      if (!a || !b) continue;
      const ring1 = sameChord(e.from, this.center);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const cx = mx - (dy / len) * 30;
      const cy = my + (dx / len) * 30;
      const g = s('g', { class: `w-path kind-${e.kind}${ring1 ? '' : ' far'}` });
      g.append(
        s('path', { d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`, class: 'w-path-under' }),
        s('path', { d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`, class: 'w-path-line', stroke: th.palette.path, 'stroke-dasharray': EDGE_DASH[e.kind] }),
      );
      if (ring1) {
        // Point de la courbe à 62 % du trajet : la pastille reste hors de l'îlot central.
        const tq = 0.62;
        const ix = (1 - tq) ** 2 * a.x + 2 * (1 - tq) * tq * cx + tq * tq * b.x;
        const iy = (1 - tq) ** 2 * a.y + 2 * (1 - tq) * tq * cy + tq * tq * b.y;
        g.append(s('circle', { cx: ix, cy: iy, r: 17, class: 'w-path-chip' }), s('text', { x: ix, y: iy + 6, 'text-anchor': 'middle', class: 'w-path-icon', text: EDGE_ICON[e.kind] }));
      }
      pathsG.append(g);
    }
    const sorted = [...nodes].sort((a, b) => a.y - b.y);
    for (const n of sorted) islandsG.append(this.island(n, pos.get(chordId(n.chord))!, enter));
    this.cam.replaceChildren(pathsG, islandsG, this.mascot.root);
    const c = pos.get(chordId(this.center))!;
    if (!this.jump) this.placeMascot(c.x, c.y - 14 * c.k, idlePose(0));
    this.applyPan();
    this.renderInfo();
  }

  private island(n: WorldNode, p: { x: number; y: number; k: number }, enter: boolean): SVGElement {
    const th = this.themes.current;
    const compact = isCompact();
    const R = n.ring === 0 ? (compact ? 100 : 92) : n.ring === 1 ? (compact ? 84 : 66) : 46;
    const depth = n.ring === 0 ? 30 : n.ring === 1 ? 22 : 15;
    const ry = R * 0.42;
    const gradId = `isl-${th.id}-${n.ring}`;
    const name = nameOf(this.ctx, n.chord, this.key);
    const roman = romanPretty(romanNumeral(n.chord, this.key));
    const label = n.edge ? `${name}, ${t(`edge.${n.edge.kind}`)}` : t('world.here', { chord: name });
    const g = s('g', {
      class: `w-island ring-${n.ring}${enter && n.ring > 0 ? ' enter' : ''}${n.edge ? ` kind-${n.edge.kind}` : ''}`,
      transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.k.toFixed(3)})`,
      role: 'button',
      tabindex: n.ring === 2 ? -1 : 0,
      'aria-label': label,
      'data-chord': chordId(n.chord),
    });
    g.append(
      s('defs', {}, [s('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, [s('stop', { offset: 0, 'stop-color': th.palette.islandTop[0] }), s('stop', { offset: 1, 'stop-color': th.palette.islandTop[1] })])]),
      s('ellipse', { cx: 0, cy: depth + 14, rx: R * 1.08, ry: ry * 0.9, class: 'w-isl-shadow' }),
      s('path', { d: `M${-R} 0 A${R} ${ry} 0 0 0 ${R} 0 V${depth} A${R} ${ry} 0 0 1 ${-R} ${depth} Z`, fill: th.palette.islandSide, class: 'w-isl-side' }),
      s('ellipse', { cx: 0, cy: 0, rx: R, ry, fill: `url(#${gradId})`, class: 'w-isl-top' }),
      s('ellipse', { cx: 0, cy: 0, rx: R - 3, ry: ry - 2, fill: 'none', stroke: th.palette.islandRim, class: 'w-isl-rim' }),
      s('ellipse', { cx: -R * 0.35, cy: -ry * 0.45, rx: R * 0.3, ry: ry * 0.22, class: 'w-isl-shine' }),
      ...islandProps(th, R, ry),
      s('text', { x: 0, y: n.ring === 0 ? depth * 0.5 + 13 : compact ? 12 : 7, 'text-anchor': 'middle', class: `w-isl-name${n.ring === 0 ? ' big' : ''}`, fill: n.ring === 0 ? '#ffffff' : th.palette.label, stroke: n.ring === 0 ? '#0a0a12' : 'none', text: name }),
    );
    if (n.ring === 1) g.append(s('text', { x: 0, y: compact ? 36 : 27, 'text-anchor': 'middle', class: 'w-isl-roman', fill: th.palette.label, text: roman }));
    if (n.ring > 0 && n.edge) {
      const go = () => this.travel(n.edge!, n.chord);
      g.addEventListener('click', (e) => {
        if (this.drag?.moved) return;
        e.stopPropagation();
        go();
      });
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          go();
        }
      });
    }
    return g;
  }

  // ------------------------------------------------------------------ navigation

  /** Prend un chemin : la mascotte saute (au prochain temps si le métronome tourne). */
  travel(edge: WorldEdge | null, target: Chord, key: Key = edge?.key ?? this.key, silent = false): void {
    if (sameChord(target, this.center)) return;
    const from = this.toScene({ x: 0, y: 0 });
    const node = this.nodes.find((n) => sameChord(n.chord, target));
    const to = node ? this.toScene(node) : { x: from.x + 220, y: from.y, k: 1 };
    const j = { from: { x: from.x, y: from.y - 14 * from.k }, to: { x: to.x, y: to.y - 8 * to.k }, edge, target, key };
    if (!silent) this.play(target);
    if (ParticleLayer.reducedMotion()) {
      this.arrive(j.edge, j.target, j.key);
      return;
    }
    if (this.metroRunning() && this.lastBeat) {
      this.pendingJump = j; // décolle au prochain temps, atterrit sur le suivant
    } else {
      this.jump = { ...j, start: performance.now() / 1000, dur: 0.55, audioClock: false };
    }
    this.ensureLoop();
    // Filet de sécurité : si l'animation est suspendue (onglet caché, veille), on arrive quand même.
    const token = {};
    this.jumpToken = token;
    setTimeout(() => {
      if (this.jumpToken !== token || (!this.jump && !this.pendingJump)) return;
      const pend = this.jump ?? this.pendingJump!;
      this.jump = null;
      this.pendingJump = null;
      this.arrive(pend.edge, pend.target, pend.key);
    }, 2500);
  }
  private jumpToken: object | null = null;

  private arrive(edge: WorldEdge | null, target: Chord, key: Key): void {
    this.trail.push({ chord: this.center, key: this.key });
    if (this.trail.length > 24) this.trail.shift();
    this.lastEdge = edge;
    this.center = target;
    this.key = key;
    this.pan = { x: 0, y: 0 };
    this.layout(true);
    this.renderTrail();
    // Résolution vers la tonique : petite célébration.
    if (edge?.kind === 'resolution' && target.root === key.tonic) this.celebrate();
  }

  /** Accord joué (détection) ou accord de l'accompagnement : le monde suit. */
  follow(c: Chord, key: Key | null = null): void {
    if (sameChord(c, this.center)) return;
    const node = this.nodes.find((n) => n.ring > 0 && sameChord(n.chord, c));
    if (node?.edge) this.travel(node.edge, c, node.edge.key, true);
    else this.travel(null, c, key ?? this.key, true);
  }

  back(): void {
    const prev = this.trail.pop();
    if (!prev) return;
    this.lastEdge = null;
    this.center = prev.chord;
    this.key = prev.key;
    this.pan = { x: 0, y: 0 };
    this.layout(true);
    this.renderTrail();
  }

  recenter(): void {
    this.pan = { x: 0, y: 0 };
    this.key = this.shared.key;
    this.applyPan();
    this.layout();
  }

  celebrate(): void {
    this.celebrateStart = performance.now() / 1000;
    const c = this.toScene({ x: 0, y: 0 });
    this.particles.burst((c.x - VIEW.x) / VIEW.w, (c.y - VIEW.y - 40) / VIEW.h, 22);
    this.mascot.root.classList.add('celebrating');
    setTimeout(() => this.mascot.root.classList.remove('celebrating'), 900);
    this.ensureLoop();
  }

  private play(c: Chord): void {
    const midi = soundingMidi(GUITAR, chordPositions(GUITAR, c)[0]!.frets);
    void this.ctx.engine.resume().then(() => playChord(this.ctx.engine.ctx, this.ctx.engine.synthBus, midi, this.ctx.settings.playStyle));
  }

  // ------------------------------------------------------------------ panoramique

  private bindPan(): void {
    this.scene.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y, moved: false };
    });
    this.scene.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const rect = this.scene.getBoundingClientRect();
      const k = VIEW.w / Math.max(1, rect.width);
      const dx = (e.clientX - this.drag.x) * k;
      const dy = (e.clientY - this.drag.y) * k;
      if (Math.hypot(dx, dy) > 12) this.drag.moved = true;
      if (!this.drag.moved) return;
      this.scene.setPointerCapture?.(e.pointerId);
      this.pan = { x: Math.max(-380, Math.min(380, this.drag.px + dx)), y: Math.max(-240, Math.min(240, this.drag.py + dy)) };
      this.applyPan();
    });
    const end = () => setTimeout(() => (this.drag = null), 0);
    this.scene.addEventListener('pointerup', end);
    this.scene.addEventListener('pointercancel', end);
  }

  private applyPan(): void {
    this.cam.setAttribute('transform', `translate(${this.pan.x.toFixed(1)} ${this.pan.y.toFixed(1)})`);
  }

  // ------------------------------------------------------------------ mascotte & horloge

  /** Temps du métronome (événement déjà aligné sur l'horloge visuelle). */
  onBeat(e: TickEvent): void {
    if (e.sub !== 0) return;
    this.lastBeat = e;
    const b = this.mascot.badge;
    b.classList.add('on');
    this.mascot.badgeText.textContent = String(e.beat + 1);
    b.classList.toggle('accent', e.beat === 0);
    b.classList.remove('pop');
    void (b as unknown as HTMLElement).getBoundingClientRect();
    b.classList.add('pop');
    if (this.pendingJump) {
      const period = 60 / e.bpm;
      this.jump = { ...this.pendingJump, start: e.time, dur: period, audioClock: true };
      this.pendingJump = null;
    }
    this.ensureLoop();
  }

  onStop(): void {
    this.lastBeat = null;
    this.mascot.badgeText.textContent = '';
    this.mascot.badge.classList.remove('accent', 'pop', 'on');
    if (this.pendingJump) {
      const j = this.pendingJump;
      this.pendingJump = null;
      this.arrive(j.edge, j.target, j.key);
    }
  }

  private placeMascot(x: number, y: number, pose: Pose): void {
    this.mascot.root.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    this.mascot.body.setAttribute('transform', `translate(0 ${pose.y.toFixed(1)}) rotate(${pose.rot.toFixed(1)}) scale(${pose.sx.toFixed(3)} ${pose.sy.toFixed(3)})`);
    this.mascot.armL.setAttribute('transform', `translate(-40 -52) rotate(${(-pose.arms).toFixed(1)})`);
    this.mascot.armR.setAttribute('transform', `translate(40 -52) rotate(${pose.arms.toFixed(1)})`);
    this.mascot.shadow.setAttribute('transform', `scale(${(1 + pose.y / 160).toFixed(3)} 1)`);
  }

  private ensureLoop(): void {
    if (!this.visible || this.raf) return;
    const loop = () => {
      this.raf = 0;
      if (!this.visible) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(): void {
    const th = this.themes.current;
    const reduced = ParticleLayer.reducedMotion();
    const motion = reduced ? { hop: 0, squash: 0, sway: 0 } : th.motion;
    const c = this.toScene({ x: 0, y: 0 });
    const home = { x: c.x, y: c.y - 14 * c.k };
    if (this.jump) {
      const j = this.jump;
      const now = j.audioClock ? this.visualClock() : performance.now() / 1000;
      const q = (now - j.start) / j.dur;
      if (q >= 1) {
        this.jump = null;
        this.arrive(j.edge, j.target, j.key);
        return;
      }
      if (q >= 0) {
        const p = jumpPoint(q, j.from.x, j.from.y, j.to.x, j.to.y, 120);
        this.placeMascot(p.x, p.y, { y: 0, sx: 1, sy: 1, rot: (j.to.x - j.from.x) * 0.02 * Math.sin(Math.PI * q), arms: -50 });
        return;
      }
    }
    const nowPerf = performance.now() / 1000;
    if (this.celebrateStart > 0 && nowPerf - this.celebrateStart < 0.8) {
      this.placeMascot(home.x, home.y, celebratePose((nowPerf - this.celebrateStart) / 0.8, motion));
      return;
    }
    const e = this.lastBeat;
    if (e && this.metroRunning()) {
      const period = 60 / e.bpm;
      const phase = (this.visualClock() - e.time) / period;
      this.placeMascot(home.x, home.y, hopPose(phase, (e.beat + 1) % e.beatsPerBar === 0, e.beat, motion));
    } else {
      this.placeMascot(home.x, home.y, reduced ? idlePose(0) : idlePose(nowPerf));
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) {
      this.particles.lowPower = this.ctx.settings.lowPower;
      this.particles.start();
      this.ensureLoop();
    } else {
      this.particles.stop();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  // ------------------------------------------------------------------ textes

  private renderInfo(): void {
    const name = nameOf(this.ctx, this.center, this.key);
    const e = this.lastEdge;
    const lines: (HTMLElement | null)[] = [
      h('p', { class: 'w-where' }, [h('strong', { text: name }), ` · ${romanPretty(romanNumeral(this.center, this.key))} · ${keyLabel(this.ctx, this.key)}`]),
      e
        ? h('p', { class: 'w-why' }, [
            h('span', { class: 'w-why-icon', 'aria-hidden': 'true', text: EDGE_ICON[e.kind] }),
            ` ${t(`edgeWhy.${e.kind}`, { from: nameOf(this.ctx, e.from, this.key), to: name })} ${t(e.shared === 1 ? 'world.shared1' : 'world.shared', { n: e.shared })}`,
          ])
        : h('p', { class: 'w-why small', text: t('world.hint') }),
    ];
    this.info.replaceChildren(...(lines.filter(Boolean) as HTMLElement[]));
  }

  private renderTrail(): void {
    const items = this.trail.slice(-8);
    this.trailEl.replaceChildren(
      ...items.map((it, i) => {
        const b = h('button', { type: 'button', class: 'link', text: nameOf(this.ctx, it.chord, it.key) });
        b.addEventListener('click', () => {
          // Revenir à une étape de l'historique.
          const idx = this.trail.length - items.length + i;
          const target = this.trail[idx]!;
          this.trail = this.trail.slice(0, idx);
          this.center = target.chord;
          this.key = target.key;
          this.lastEdge = null;
          this.layout(true);
          this.renderTrail();
        });
        return h('li', {}, [b]);
      }),
      h('li', { class: 'cur', text: nameOf(this.ctx, this.center, this.key) }),
    );
  }

  /** Re-rendu complet (langue, notation…). */
  render(): void {
    this.scene.setAttribute('aria-label', t('world.title'));
    this.layout();
    this.renderTrail();
  }

  get currentChord(): Chord {
    return this.center;
  }
}

/** Petits décors posés sur les îlots, selon le monde. */
function islandProps(th: WorldTheme, R: number, ry: number): SVGElement[] {
  const out: SVGElement[] = [];
  const at = (fx: number, fy: number) => ({ x: fx * R, y: fy * ry });
  switch (th.id) {
    case 'folk':
      for (const [fx, fy] of [[-0.7, 0.2], [0.65, -0.1], [0.4, 0.5]] as const) {
        const p = at(fx, fy);
        out.push(s('path', { d: `M${p.x - 5} ${p.y} q3 -10 5 0 q2 -12 5 0`, stroke: '#3f6b35', 'stroke-width': 2, fill: 'none', class: 'w-prop' }));
      }
      break;
    case 'country':
      for (const [fx, fy] of [[-0.6, 0.3], [0.7, 0.1]] as const) {
        const p = at(fx, fy);
        out.push(s('ellipse', { cx: p.x, cy: p.y, rx: 5, ry: 3, fill: '#a4502f', opacity: 0.6, class: 'w-prop' }));
      }
      break;
    case 'pop':
      for (const [fx, fy, c] of [[-0.6, 0.2, '#6fd3ff'], [0.55, -0.2, '#ffd23f'], [0.3, 0.5, '#8ef0b0'], [-0.2, -0.5, '#ff6fb5']] as const) {
        const p = at(fx, fy);
        out.push(s('rect', { x: p.x - 4, y: p.y - 1.5, width: 8, height: 3, rx: 1.5, fill: c, transform: `rotate(${fx * 60} ${p.x} ${p.y})`, class: 'w-prop' }));
      }
      break;
    case 'jazz':
      for (const [fx, fy] of [[-0.7, 0], [0.7, 0], [0, 0.75]] as const) {
        const p = at(fx, fy);
        out.push(s('circle', { cx: p.x, cy: p.y, r: 2.5, fill: '#e8c160', class: 'w-prop' }));
      }
      break;
    default:
      break;
  }
  return out;
}
