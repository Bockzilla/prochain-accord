import './styles.css';
import { startApp } from './ui/app';

startApp(document.getElementById('app')!);

// Service worker (hors ligne) — uniquement dans la version publiée.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* hors ligne indisponible : l'app fonctionne quand même en ligne */
    });
  });
}
