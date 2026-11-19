import type { ProfileId } from './profiles';

/**
 * Calibration guidée — logique PURE.
 * Étape 1 : quelques secondes de silence → bruit de fond.
 * Étape 2 : un accord tenu → niveau du signal et netteté de la reconnaissance.
 * Étape 3 : analyse → qualité, profil et sensibilité recommandés.
 */
export interface FrameMeasure {
  rms: number;
  /** Confiance de la reconnaissance d'accord (0..1). */
  confidence: number;
}

export type SignalQuality = 'good' | 'fair' | 'poor';

export type CalibrationAdvice = 'tooQuiet' | 'clipping' | 'noisyRoom' | 'unclearChord' | 'allGood' | 'tryInterface';

export interface CalibrationResult {
  noiseRms: number;
  signalRms: number;
  /** Rapport signal / bruit (dB). */
  snrDb: number;
  /** Confiance médiane sur l'accord tenu. */
  clarity: number;
  quality: SignalQuality;
  profile: ProfileId;
  /** Sensibilité recommandée (0..1, réglage existant). */
  sensitivity: number;
  advice: CalibrationAdvice[];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** Sensibilité (0..1) dont le seuil manuel se place juste au-dessus du bruit mesuré. Inverse de noiseGateFor(). */
export function sensitivityForGate(gate: number): number {
  const x = Math.max(0, (gate - 0.0005) / 0.03);
  return Math.max(0, Math.min(1, 1 - Math.sqrt(x)));
}

export function analyzeCalibration(silence: FrameMeasure[], chord: FrameMeasure[]): CalibrationResult {
  // Bruit : médiane (les petits bruits ponctuels ne doivent pas fausser la mesure).
  const noiseRms = Math.max(1e-5, median(silence.map((f) => f.rms)));
  // Signal : on ne garde que les trames nettement au-dessus du bruit (l'accord, pas les silences autour).
  const playing = chord.filter((f) => f.rms > noiseRms * 2);
  const signalRms = median(playing.map((f) => f.rms));
  const clarity = median(playing.map((f) => f.confidence));
  const snrDb = signalRms > 0 ? 20 * Math.log10(signalRms / noiseRms) : 0;
  const peak = Math.max(0, ...chord.map((f) => f.rms));

  const advice: CalibrationAdvice[] = [];
  if (playing.length < Math.max(3, chord.length * 0.3) || signalRms < 0.004) advice.push('tooQuiet');
  if (peak > 0.6) advice.push('clipping');
  if (snrDb < 15) advice.push('noisyRoom');
  if (clarity < 0.5 && playing.length >= 3) advice.push('unclearChord');

  let quality: SignalQuality;
  if (snrDb >= 25 && clarity >= 0.65 && !advice.includes('tooQuiet')) quality = 'good';
  else if (snrDb >= 15 && clarity >= 0.45 && !advice.includes('tooQuiet')) quality = 'fair';
  else quality = 'poor';

  const profile: ProfileId = quality === 'good' ? 'fast' : quality === 'fair' ? 'balanced' : 'stable';
  if (quality === 'poor' && !advice.includes('tooQuiet')) advice.push('tryInterface');
  if (advice.length === 0) advice.push('allGood');

  // Seuil manuel : 2× le bruit mesuré, sans dépasser le quart du signal (pour ne pas couper les accords doux).
  const gate = Math.min(noiseRms * 2, signalRms > 0 ? signalRms / 4 : noiseRms * 2);
  return { noiseRms, signalRms, snrDb, clarity, quality, profile, sensitivity: sensitivityForGate(gate), advice };
}
