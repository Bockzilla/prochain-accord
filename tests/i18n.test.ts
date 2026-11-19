import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import es from '../src/i18n/es.json';
import fr from '../src/i18n/fr.json';
import { detectLocale, setLocale, t } from '../src/i18n/i18n';
import { chordName, defaultNotation, pcName } from '../src/i18n/notation';
import { chord } from '../src/theory/chords';
import { PROGRESSIONS, STYLES } from '../src/theory/harmony';
import { SCALE_TYPES } from '../src/theory/scales';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const src = files('src').filter((f) => f.endsWith('.ts'));

describe('fichiers de langue', () => {
  it('fr, en et es ont exactement les mêmes clés', () => {
    const k = (o: object) => Object.keys(o).sort();
    expect(k(en)).toEqual(k(fr));
    expect(k(es)).toEqual(k(fr));
  });
  it('aucune traduction vide, et les mêmes {paramètres} dans les 3 langues', () => {
    const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(fr)) {
      for (const d of [fr, en, es] as Record<string, string>[]) expect(d[key]!.trim().length, key).toBeGreaterThan(0);
      expect(params((en as Record<string, string>)[key]!), key).toBe(params((fr as Record<string, string>)[key]!));
      expect(params((es as Record<string, string>)[key]!), key).toBe(params((fr as Record<string, string>)[key]!));
    }
  });
  it('chaque clé utilisée dans le code existe', () => {
    const used = new Set<string>();
    for (const f of src) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]!);
    for (const f of src) for (const m of readFileSync(f, 'utf8').matchAll(/'([a-z]+\.[a-zA-Z0-9]+)'/g)) if (m[1]! in fr) used.add(m[1]!);
    // Clés construites dynamiquement
    const dyn = [
      ...['accent', 'normal', 'mute'].map((x) => `beat.${x}`),
      ...['safe', 'colorful', 'bold'].map((x) => `category.${x}`),
      ...['guitar', 'mandolin', 'piano'].map((x) => `instrument.${x}`),
      ...[0, 1, 2, 3].map((x) => `inversion.${x}`),
      ...['fr', 'en', 'es'].map((x) => `lang.${x}`),
      ...['tonic', 'diatonic', 'dominant', 'subdominant', 'relativeMinor', 'relativeMajor', 'fifthDown', 'resolution', 'secondaryDominant', 'borrowed', 'chromaticMediant', 'neapolitan'].map((x) => `reason.${x}`),
      ...['open', 'eShape', 'aShape', 'upNeck'].map((x) => `shape.${x}`),
      ...['click', 'wood', 'hihat', 'beep'].map((x) => `sound.${x}`),
      ...[1, 2, 3, 4].map((x) => `subdiv.${x}`),
      ...[0, 1, 2].map((x) => `training.countIn${x}`),
      'key.major', 'key.minor', 'key.estimated', 'key.estimatedUnsure', 'metro.plus', 'metro.minus',
      ...['play', 'improvise', 'accompany', 'understand'].map((x) => `space.${x}`),
      ...STYLES.flatMap((x) => [`style.${x}`, `styleExplain.${x}`]),
      ...PROGRESSIONS.map((p) => `prog.${p.id}`),
      ...SCALE_TYPES.flatMap((x) => [`scale.${x}`, `beginner.scale.${x}`]),
      ...['tonic', 'subdominant', 'dominant', 'outside'].flatMap((x) => [`fn.${x}`, `fnRole.${x}`]),
      ...['high', 'medium', 'low'].map((x) => `analysis.certainty.${x}`),
      ...['pentatonicSafe', 'fullScale', 'bluesColor', 'relativeSame', 'majorPentaOverDominant', 'mixolydianB7'].map((x) => `scaleReason.${x}`),
      ...['drums', 'comp', 'click'].map((x) => `accompany.vol.${x}`),
    ];
    for (const k of [...used, ...dyn]) expect(fr, k).toHaveProperty([k]);
  });
  it('toutes les raisons du moteur de suggestions sont traduites', () => {
    const graph = readFileSync('src/suggestions/graph.ts', 'utf8');
    const union = /export type ReasonKey =([\s\S]*?);/.exec(graph)![1]!;
    for (const m of union.matchAll(/'(\w+)'/g)) expect(fr).toHaveProperty([`reason.${m[1]}`]);
  });
});

describe('aucun texte codé en dur dans l’interface', () => {
  const ui = src.filter((f) => /[\\/](ui|render)[\\/]/.test(f));
  it('pas de textContent / text: avec une phrase littérale', () => {
    const offenders: string[] = [];
    for (const f of ui) {
      const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Littéraux contenant au moins un mot de 3 lettres, affectés à du texte visible.
      for (const m of code.matchAll(/(textContent\s*=|text:|placeholder:|'aria-label':)\s*(['"`])([^'"`]*?)\2/g)) {
        // Les interpolations ${…} sont du code, pas du texte affiché : on les retire avant de chercher des mots.
        const literal = m[3]!.replace(/\$\{[^}]*\}/g, '').replace(/\$\{.*$/, '');
        if (/[A-Za-zÀ-ÿ]{3,}/.test(literal)) offenders.push(`${f}: ${m[3]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('index.html ne contient pas de texte d’interface (hors <noscript> et <title>)', () => {
    const html = readFileSync('index.html', 'utf8');
    const body = /<body>([\s\S]*)<\/body>/.exec(html)![1]!;
    // Le corps ne doit contenir QUE ces trois éléments (le texte vient entièrement de i18n/).
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('<div id="app"></div>');
    expect(lines[1]!.startsWith('<noscript>')).toBe(true);
    expect(lines[2]).toBe('<script type="module" src="/src/main.ts"></script>');
  });
});

describe('langue et notation', () => {
  it('langue détectée depuis navigator.language', () => {
    expect(detectLocale(['fr-CA', 'en'])).toBe('fr');
    expect(detectLocale(['es-MX'])).toBe('es');
    expect(detectLocale(['de-DE', 'en-US'])).toBe('en');
    expect(detectLocale(['ja'])).toBe('en');
  });
  it('notation par défaut : es → latine, fr/en → anglo-saxonne', () => {
    expect(defaultNotation('es')).toBe('latin');
    expect(defaultNotation('fr')).toBe('anglo');
    expect(defaultNotation('en')).toBe('anglo');
  });
  it('noms de notes : C/Do/Ré selon notation et langue', () => {
    expect(pcName(2, 'anglo', 'fr')).toBe('D');
    expect(pcName(2, 'latin', 'fr')).toBe('Ré');
    expect(pcName(2, 'latin', 'es')).toBe('Re');
    expect(pcName(7, 'latin', 'en')).toBe('Sol');
    expect(chordName(chord(9, 'min'), 'latin', 'fr')).toBe('Lam');
    expect(chordName(chord(6, '7'), 'anglo', 'en')).toBe('F♯7');
    expect(chordName(chord(10), 'anglo', 'en', { tonic: 5, mode: 'major' })).toBe('B♭');
    expect(chordName(chord(10), 'latin', 'fr', { tonic: 5, mode: 'major' })).toBe('Si♭');
  });
  it('traduction avec paramètres et repli', () => {
    setLocale('fr');
    expect(t('metro.bar', { n: 3 })).toBe('Mesure 3');
    setLocale('es');
    expect(t('metro.bar', { n: 3 })).toBe('Compás 3');
    expect(t('cle.inexistante')).toBe('cle.inexistante');
    setLocale('en');
  });
});

describe('orthographe des accords chromatiques', () => {
  it('♭VII en Do s’écrit B♭, pas A♯', async () => {
    const { spellingForRoman } = await import('../src/i18n/notation');
    const key = { tonic: 0, mode: 'major' as const };
    expect(chordName(chord(10, 'min'), 'anglo', 'en', key, spellingForRoman('bvii', key))).toBe('B♭m');
    expect(chordName(chord(6), 'anglo', 'en', key, spellingForRoman('#IV', key))).toBe('F♯');
  });
});

describe('saisie d’une progression', () => {
  it('notations anglo-saxonne et latine', async () => {
    const { parseChordName, parseProgression } = await import('../src/i18n/notation');
    expect(parseChordName('Am')).toEqual({ root: 9, quality: 'min' });
    expect(parseChordName('F#7')).toEqual({ root: 6, quality: '7' });
    expect(parseChordName('Bb')).toEqual({ root: 10, quality: 'maj' });
    expect(parseChordName('B♭maj7')).toEqual({ root: 10, quality: 'maj7' });
    expect(parseChordName('Lam')).toEqual({ root: 9, quality: 'min' });
    expect(parseChordName('Sib')).toEqual({ root: 10, quality: 'maj' });
    expect(parseChordName('Ré7')).toEqual({ root: 2, quality: '7' });
    expect(parseChordName('Bdim')).toEqual({ root: 11, quality: 'dim' });
    expect(parseChordName('H7')).toBeNull();
    const p = parseProgression('Am – F, C | G  xyz');
    expect(p.chords.map((c) => c.root)).toEqual([9, 5, 0, 7]);
    expect(p.invalid).toEqual(['xyz']);
  });
});
