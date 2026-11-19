/**
 * Réveil périodique du planificateur. Il ne produit AUCUN son : il dit seulement
 * « regarde s'il faut planifier des clics ». Tourne dans un Web Worker pour ne pas
 * être ralenti par l'interface ; repli sur le thread principal si les workers sont indisponibles.
 */
export interface Ticker {
  stop(): void;
}

export function startTicker(cb: () => void, intervalMs = 25): Ticker {
  try {
    const w = new Worker(new URL('./tick-worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = () => cb();
    w.postMessage({ interval: intervalMs });
    return { stop: () => w.terminate() };
  } catch {
    const id = setInterval(cb, intervalMs);
    return { stop: () => clearInterval(id) };
  }
}
