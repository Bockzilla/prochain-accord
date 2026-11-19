import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Frontières pour la future version DJ (BEATBOCK) :
 * theory/ et metronome/ doivent rester réutilisables sans l'interface ni la capture audio.
 */
function imports(dir: string): { file: string; spec: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .flatMap((f) => {
      const code = readFileSync(join(dir, f), 'utf8');
      return [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => ({ file: f, spec: m[1]! }));
    });
}

describe('découplage des modules', () => {
  it('theory/ est pur : aucune importation hors de theory/', () => {
    const bad = imports('src/theory').filter((i) => !i.spec.startsWith('./'));
    expect(bad).toEqual([]);
  });
  it('theory/ n’utilise aucune API du navigateur', () => {
    for (const f of readdirSync('src/theory')) {
      const code = readFileSync(join('src/theory', f), 'utf8');
      expect(code, f).not.toMatch(/\b(window|document|navigator|AudioContext|localStorage)\b/);
    }
  });
  it('metronome/ ne dépend ni de ui/, ni de render/, ni de detection/, ni de audio/', () => {
    const bad = imports('src/metronome').filter((i) => /\.\.\/(ui|render|detection|audio|i18n|instruments|suggestions)/.test(i.spec));
    expect(bad).toEqual([]);
  });
  it('suggestions/, instruments/ et detection/ ne dépendent pas de l’interface', () => {
    for (const d of ['src/suggestions', 'src/instruments', 'src/detection']) {
      const bad = imports(d).filter((i) => /\.\.\/(ui|render)\b/.test(i.spec));
      expect(bad, d).toEqual([]);
    }
  });
  it('aucun appel réseau dans le code de l’application', () => {
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const f of walk('src').filter((x) => x.endsWith('.ts'))) {
      const code = readFileSync(f, 'utf8');
      expect(code, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|\beval\(|new Function\(/);
    }
  });
});
