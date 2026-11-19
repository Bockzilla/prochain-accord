import type { ChordQuality } from '../theory/chords';
import { bassPitchClass, computeChroma, DEFAULT_CHROMA, rms, type ChromaOptions } from './chroma';
import { magnitudeSpectrum } from './fft';
import { confidence, matchChord, type Match } from './matcher';

export interface FrameAnalysis {
  rms: number;
  chroma: Float64Array;
  /** Classe de hauteur de la basse, -1 si inconnue. */
  bass: number;
  matches: Match[];
  confidence: number;
  /** Faux si le signal est sous le seuil de bruit (silence). */
  gateOpen: boolean;
}

export interface AnalyzeOptions {
  qualities: ChordQuality[];
  /** Seuil RMS du « gate » de bruit (réglage de sensibilité du micro). */
  noiseGate: number;
  chroma: ChromaOptions;
}

export const DEFAULT_ANALYZE: AnalyzeOptions = { qualities: ['maj', 'min'], noiseGate: 0.004, chroma: DEFAULT_CHROMA };

/** Pipeline pur : échantillons → spectre → chromagramme → accords candidats. */
export function analyzeFrame(samples: Float32Array | Float64Array, sampleRate: number, opts: AnalyzeOptions = DEFAULT_ANALYZE): FrameAnalysis {
  const level = rms(samples);
  if (level < opts.noiseGate) {
    return { rms: level, chroma: new Float64Array(12), bass: -1, matches: [], confidence: 0, gateOpen: false };
  }
  const mag = magnitudeSpectrum(samples);
  const chroma = computeChroma(mag, sampleRate, opts.chroma);
  const bass = bassPitchClass(mag, sampleRate, opts.chroma);
  const matches = matchChord(chroma, opts.qualities, bass);
  return { rms: level, chroma, bass, matches, confidence: confidence(matches), gateOpen: true };
}
