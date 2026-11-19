import { WORLDS, type WorldId, type WorldTheme } from './themes';

/**
 * Applique un monde à l'interface : variables CSS (accents), attribut data-world.
 * Ne touche ni à l'audio ni au métronome : un changement de monde n'interrompt rien.
 */
export class ThemeEngine {
  current: WorldTheme = WORLDS.blues;
  private listeners = new Set<(t: WorldTheme) => void>();

  apply(id: WorldId): void {
    const t = WORLDS[id] ?? WORLDS.blues;
    const changed = t.id !== this.current.id;
    this.current = t;
    const root = document.documentElement;
    root.dataset.world = t.id;
    root.style.setProperty('--accent', t.tokens.accent);
    root.style.setProperty('--accent-text', t.tokens.accentText);
    root.style.setProperty('--world-bg', t.tokens.worldBg);
    root.style.setProperty('--world-ease', t.motion.easing);
    if (changed) for (const l of this.listeners) l(t);
  }

  on(fn: (t: WorldTheme) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
