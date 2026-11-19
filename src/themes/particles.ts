import type { WorldTheme } from './themes';

/**
 * Particules d'ambiance (Canvas 2D). Purement décoratives : elles ne lisent aucune horloge audio.
 * Coupées si « réduire les animations » est demandé, réduites en mode économie, en pause hors écran.
 */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  c: string;
  rot: number;
}

export class ParticleLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private ps: P[] = [];
  private theme: WorldTheme | null = null;
  private raf = 0;
  private last = 0;
  private running = false;
  lowPower = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'particles';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
  }

  static reducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setTheme(t: WorldTheme): void {
    this.theme = t;
    this.ps = [];
  }

  private get target(): number {
    if (!this.theme || ParticleLayer.reducedMotion()) return 0;
    const n = Math.min(this.theme.particles.count, this.theme.performance.maxParticles);
    return this.lowPower ? Math.ceil(n / 3) : n;
  }

  start(): void {
    if (this.running || this.target === 0) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.step(Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Rafale de célébration (confettis / étincelles) autour d'un point (0..1 de la largeur / hauteur). */
  burst(fx: number, fy: number, n = 18): void {
    if (!this.theme || ParticleLayer.reducedMotion()) return;
    const cs = this.theme.particles.colors;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.ps.push({ x: fx, y: fy, vx: Math.cos(a) * 0.35, vy: Math.sin(a) * 0.35 - 0.2, r: 3 + (i % 3), life: 0, max: 0.9, c: cs[i % cs.length]!, rot: a });
    }
    this.start();
  }

  private spawn(): P {
    const t = this.theme!;
    const k = t.particles.kind;
    const c = t.particles.colors[Math.floor(Math.random() * t.particles.colors.length)]!;
    const sp = t.particles.speed;
    const rnd = Math.random;
    switch (k) {
      case 'smoke':
        return { x: rnd(), y: 1.05, vx: (rnd() - 0.5) * 0.02, vy: -0.03 * sp - rnd() * 0.02, r: 18 + rnd() * 30, life: 0, max: 9 + rnd() * 6, c, rot: 0 };
      case 'sparks':
        return { x: 0.15 + rnd() * 0.7, y: 1.02, vx: (rnd() - 0.5) * 0.2, vy: -0.25 * sp - rnd() * 0.2, r: 1.5 + rnd() * 1.5, life: 0, max: 1.2 + rnd(), c, rot: 0 };
      case 'fireflies':
        return { x: rnd(), y: 0.3 + rnd() * 0.65, vx: (rnd() - 0.5) * 0.03, vy: (rnd() - 0.5) * 0.03, r: 2 + rnd() * 2, life: 0, max: 5 + rnd() * 5, c, rot: rnd() * 6 };
      case 'dust':
        return { x: -0.05, y: 0.4 + rnd() * 0.55, vx: 0.04 * sp + rnd() * 0.03, vy: (rnd() - 0.5) * 0.01, r: 1 + rnd() * 2.5, life: 0, max: 14, c, rot: 0 };
      case 'glints':
        return { x: rnd(), y: rnd() * 0.8, vx: 0, vy: 0.005, r: 1.5 + rnd() * 2.5, life: 0, max: 2 + rnd() * 2, c, rot: rnd() * 6 };
      case 'confetti':
        return { x: rnd(), y: -0.05, vx: (rnd() - 0.5) * 0.05, vy: 0.08 * sp + rnd() * 0.05, r: 3 + rnd() * 3, life: 0, max: 12, c, rot: rnd() * 6 };
    }
  }

  private step(dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.theme) return;
    const w = this.canvas.clientWidth;
    const hgt = this.canvas.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    while (this.ps.length < this.target && Math.random() < 0.3) this.ps.push(this.spawn());
    const kind = this.theme.particles.kind;
    this.ps = this.ps.filter((p) => {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 2;
      if (kind === 'fireflies') {
        p.vx += (Math.random() - 0.5) * 0.01;
        p.vy += (Math.random() - 0.5) * 0.01;
      }
      if (p.life > p.max || p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1) return false;
      const fade = Math.min(1, p.life * 2, (p.max - p.life) * 2);
      ctx.globalAlpha = kind === 'smoke' ? fade * 0.12 : kind === 'fireflies' || kind === 'glints' ? fade * (0.5 + 0.5 * Math.sin(p.rot * 3)) : fade * 0.9;
      ctx.fillStyle = p.c;
      const x = p.x * w;
      const y = p.y * hgt;
      if (kind === 'confetti') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    });
    ctx.globalAlpha = 1;
  }
}
