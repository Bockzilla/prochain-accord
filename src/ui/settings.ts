import { detectLocale, LOCALES, type Locale } from '../i18n/i18n';
import { defaultNotation, type Notation } from '../i18n/notation';
import type { InstrumentId } from '../instruments/model';
import type { BeatState, Subdivision } from '../metronome/meter';
import type { SoundId } from '../metronome/presets';
import type { Volumes } from '../metronome/sounds';
import type { AcceleratorConfig, SilentBarsConfig } from '../metronome/training';
import type { ProfileId } from '../detection/profiles';
import type { Style } from '../theory/harmony';
import type { Mode } from '../theory/keys';
import type { ScaleType } from '../theory/scales';

export type Space = 'play' | 'improvise' | 'accompany' | 'understand';

export interface Settings {
  locale: Locale;
  notation: Notation;
  instrument: InstrumentId;
  lefty: boolean;
  /** 0 (peu sensible) … 1 (très sensible). */
  sensitivity: number;
  /** Décalage visuel (ms) pour compenser des écouteurs Bluetooth. */
  latencyMs: number;
  a4: number;
  extended: boolean;
  alignHistory: boolean;
  debug: boolean;
  playStyle: 'strum' | 'block';
  wakeLock: boolean;
  vibrate: boolean;
  /** Espace affiché (mémorisé). */
  space: Space;
  /** Entrée audio choisie (deviceId), '' = par défaut. */
  inputDeviceId: string;
  /** Seuil de bruit adaptatif (reconnaissance adaptative). */
  adaptive: boolean;
  /** Profil de réactivité de la reconnaissance. */
  profile: ProfileId;
  /** Canal analysé : -1 = mélange, 0 = entrée 1, 1 = entrée 2 (interface audio). */
  inputChannel: -1 | 0 | 1;
  /** Annulation d'écho du navigateur (utile seulement sur haut-parleur). */
  echoCancellation: boolean;
  /** Le micro reste ouvert d'un espace à l'autre, et est rouvert au lancement si possible. */
  micWanted: boolean;
  /** Monde visuel : 'auto' = suit le style d'accompagnement. */
  world: 'auto' | 'blues' | 'rock' | 'folk' | 'country' | 'jazz' | 'pop';
  /** Mode économie : moins de particules et d'effets (batterie). */
  lowPower: boolean;
  tuner: { mode: 'guitar' | 'chromatic' };
  playView: 'world' | 'tuner';
  music: {
    /** 'auto' = tonalité estimée à partir des accords joués ; 'manual' = choisie. */
    keyMode: 'auto' | 'manual';
    tonic: number;
    mode: Mode;
    scale: ScaleType;
    /** 0 = manche entier, 1..5 = position pentatonique. */
    position: number;
    labels: 'notes' | 'intervals';
    beginner: boolean;
    style: Style;
    progressionId: string;
    countIn: 0 | 1 | 2;
    volumes: { drums: number; comp: number; click: number };
    /** Ancien réglage V2 (conservé pour la migration). */
    headphones: boolean;
    /** Sortie du son : casque / interface audio = détection simultanée ; haut-parleur = comportement prudent. */
    output: 'headphones' | 'interface' | 'speaker';
    accompanySection: 'loops' | 'metronome';
  };
  metro: {
    bpm: number;
    signatureId: string;
    beatStates: BeatState[];
    subdivision: Subdivision;
    sound: SoundId;
    volumes: Volumes;
    countIn: 0 | 1 | 2;
    accel: AcceleratorConfig;
    silent: SilentBarsConfig;
  };
}

export function defaultSettings(langs: readonly string[]): Settings {
  const locale = detectLocale(langs);
  return {
    locale,
    notation: defaultNotation(locale),
    instrument: 'guitar',
    lefty: false,
    sensitivity: 0.6,
    latencyMs: 0,
    a4: 440,
    extended: false,
    alignHistory: true,
    debug: false,
    playStyle: 'strum',
    wakeLock: true,
    vibrate: false,
    space: 'play',
    inputDeviceId: '',
    adaptive: true,
    profile: 'balanced',
    inputChannel: -1,
    echoCancellation: false,
    micWanted: false,
    world: 'auto',
    lowPower: false,
    tuner: { mode: 'guitar' },
    playView: 'world',
    music: {
      keyMode: 'auto',
      tonic: 9,
      mode: 'minor',
      scale: 'minorPentatonic',
      position: 1,
      labels: 'notes',
      beginner: true,
      style: 'blues',
      progressionId: 'blues12',
      countIn: 1,
      volumes: { drums: 0.7, comp: 0.7, click: 0 },
      headphones: false,
      output: 'speaker',
      accompanySection: 'loops',
    },
    metro: {
      bpm: 100,
      signatureId: '4/4',
      beatStates: ['accent', 'normal', 'normal', 'normal'],
      subdivision: 1,
      sound: 'click',
      volumes: { accent: 1, beat: 0.7, sub: 0.35 },
      countIn: 0,
      accel: { enabled: false, stepBpm: 5, everyBars: 4, targetBpm: 160 },
      silent: { enabled: false, playBars: 2, muteBars: 2 },
    },
  };
}

const KEY = 'pa.settings.v1';

/** Fusion prudente : on ne garde de la sauvegarde que les champs du bon type. */
function merge<T>(base: T, saved: unknown): T {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    if (Array.isArray(base)) return (Array.isArray(saved) ? saved : base) as T;
    return (typeof saved === typeof base ? saved : base) as T;
  }
  const out = { ...base } as Record<string, unknown>;
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(out)) out[k] = merge((base as Record<string, unknown>)[k], (saved as Record<string, unknown>)[k]);
  }
  return out as T;
}

export function loadSettings(langs: readonly string[]): Settings {
  const d = defaultSettings(langs);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const saved = JSON.parse(raw) as { music?: { headphones?: boolean; output?: string } };
    const s = merge(d, saved);
    if (!LOCALES.includes(s.locale)) s.locale = d.locale;
    // Migration V2 → V3 : « J'utilise des écouteurs » devient la sortie « casque ».
    if (saved.music?.headphones && !saved.music.output) s.music.output = 'headphones';
    return s;
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : réglages non mémorisés */
  }
}

/** Sensibilité 0..1 → seuil RMS du gate de bruit. */
export function noiseGateFor(sensitivity: number): number {
  const s = Math.max(0, Math.min(1, sensitivity));
  return 0.0005 + 0.03 * (1 - s) ** 2;
}
