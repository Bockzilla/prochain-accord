// Web Worker : envoie un message « tick » à intervalle régulier (réveil du planificateur).
// Un Worker dédié ne reçoit que les messages de la page qui l'a créé ; on valide quand même
// strictement le contenu : seul un intervalle numérique raisonnable est accepté.
let id: ReturnType<typeof setInterval> | undefined;

self.onmessage = (e: MessageEvent<unknown>) => {
  // Messages d'un Worker dédié : origine vide (spécification HTML). Toute autre origine est refusée.
  if (e.origin !== '' && e.origin !== self.location.origin) return;
  const data = e.data as { interval?: unknown } | null;
  const interval = typeof data?.interval === 'number' ? data.interval : NaN;
  if (!Number.isFinite(interval) || interval < 5 || interval > 1000) return;
  if (id !== undefined) clearInterval(id);
  id = setInterval(() => (self as unknown as Worker).postMessage(0), interval);
};
