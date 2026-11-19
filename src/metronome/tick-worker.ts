// Web Worker : envoie un message « tick » à intervalle régulier (réveil du planificateur).
let id: ReturnType<typeof setInterval> | undefined;
self.onmessage = (e: MessageEvent<{ interval: number }>) => {
  if (id !== undefined) clearInterval(id);
  id = setInterval(() => (self as unknown as Worker).postMessage(0), e.data.interval);
};
