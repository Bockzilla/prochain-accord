import type { RingBuffer } from '../audio/ring-buffer';
import { analyzeFrame, DEFAULT_ANALYZE, type AnalyzeOptions, type FrameAnalysis } from './analyze';
import { rms } from './chroma';
import { ClickGate } from './click-gate';
import { NoiseFloor } from './noise-floor';
import { ChordStabilizer, type StableState } from './stabilizer';

export interface DetectorResult {
  analysis: FrameAnalysis | null;
  state: StableState;
  /** Vrai si la trame a dû éviter un clic du métronome. */
  avoidedClick: boolean;
  /** Seuil de bruit effectivement utilisé (adaptatif). */
  gateLevel: number;
}

/**
 * Détecteur temps réel : choisit la fenêtre d'analyse (en évitant les clics),
 * l'analyse, puis stabilise le résultat.
 */
export class ChordDetector {
  readonly gate = new ClickGate();
  readonly stabilizer = new ChordStabilizer();
  readonly noise = new NoiseFloor();
  options: AnalyzeOptions = { ...DEFAULT_ANALYZE };
  /** Seuil réglé à la main (sensibilité) ; le seuil adaptatif ne descend jamais en dessous. */
  manualGate = DEFAULT_ANALYZE.noiseGate;
  adaptive = true;
  private lastConfidence = 0;
  private lastState: StableState = { current: null, last: null, changed: false };

  constructor(
    public sampleRate: number,
    public frameSize = 8192,
  ) {}

  step(ring: RingBuffer, nowMs: number): DetectorResult {
    const lastFrame = ring.lastFrame;
    if (lastFrame < this.frameSize) return { analysis: null, state: this.lastState, avoidedClick: false, gateLevel: this.options.noiseGate };
    const sr = this.sampleRate;
    const bufferEnd = lastFrame / sr;
    const cleanEnd = this.gate.findCleanEnd(bufferEnd, this.frameSize / sr);
    let frame: Float32Array | null;
    let avoided = false;
    if (cleanEnd !== null) {
      avoided = cleanEnd < bufferEnd;
      frame = ring.read(this.frameSize, Math.floor(cleanEnd * sr));
    } else {
      frame = ring.read(this.frameSize, lastFrame);
      if (frame && this.gate.apply(frame, sr, bufferEnd) > 0.5) frame = null; // trop de clics : on saute
      avoided = true;
    }
    if (!frame) return { analysis: null, state: this.lastState, avoidedClick: avoided, gateLevel: this.options.noiseGate };
    // Bruit de fond : on n'apprend que sur les trames qui ne sont PAS un accord net.
    if (this.lastConfidence < 0.3) this.noise.update(rms(frame), nowMs / 1000);
    const gateLevel = this.adaptive ? this.noise.gate(this.manualGate) : this.manualGate;
    this.options = { ...this.options, noiseGate: gateLevel };
    const analysis = analyzeFrame(frame, sr, this.options);
    this.lastConfidence = analysis.gateOpen ? analysis.confidence : 0;
    const best = analysis.gateOpen ? analysis.matches[0]?.chord ?? null : null;
    this.lastState = this.stabilizer.update(best, analysis.confidence, nowMs);
    return { analysis, state: this.lastState, avoidedClick: avoided, gateLevel };
  }
}
