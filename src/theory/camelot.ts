import type { Key } from './keys';
import { mod12 } from './notes';

/**
 * Notation Camelot (roue utilisée par les DJ) — préparée pour BEATBOCK.
 * Do majeur = 8B, La mineur = 8A ; +1 = une quinte au-dessus.
 */
export interface CamelotCode {
  number: number; // 1..12
  letter: 'A' | 'B'; // A = mineur, B = majeur
}

export function toCamelot(k: Key): CamelotCode {
  const majorTonic = k.mode === 'major' ? k.tonic : mod12(k.tonic + 3);
  const number = ((mod12(majorTonic * 7) + 7) % 12) + 1;
  return { number, letter: k.mode === 'major' ? 'B' : 'A' };
}

export function fromCamelot(c: CamelotCode): Key {
  const steps = mod12(c.number - 8); // nombre de quintes depuis Do
  const majorTonic = mod12(steps * 7);
  return c.letter === 'B'
    ? { tonic: majorTonic, mode: 'major' }
    : { tonic: mod12(majorTonic + 9), mode: 'minor' };
}

export function camelotLabel(c: CamelotCode): string {
  return `${c.number}${c.letter}`;
}

/** Tonalités compatibles pour un enchaînement « harmonique » (même, ±1, relatif). */
export function camelotNeighbours(c: CamelotCode): CamelotCode[] {
  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
  return [
    { number: wrap(c.number - 1), letter: c.letter },
    { number: wrap(c.number + 1), letter: c.letter },
    { number: c.number, letter: c.letter === 'A' ? 'B' : 'A' },
  ];
}
