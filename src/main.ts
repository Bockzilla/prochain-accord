import './styles.css';
import { setLocale } from './i18n/i18n';
import { startApp } from './ui/app';
import { renderGallery } from './ui/gallery';
import { loadSettings } from './ui/settings';

const root = document.getElementById('app')!;
if (location.hash === '#galerie') {
  // Revue visuelle des mondes et des costumes.
  setLocale(loadSettings(navigator.languages ?? [navigator.language]).locale);
  renderGallery(root);
  window.addEventListener('hashchange', () => location.reload());
} else {
  startApp(root);
}

// Service worker (hors ligne) — uniquement dans la version publiée.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* hors ligne indisponible : l'app fonctionne quand même en ligne */
    });
  });
}
