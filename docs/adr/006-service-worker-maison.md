# ADR 006 — Service worker maison

**Statut :** accepté — 2026-11-18

**Décision.** Un plugin Vite (dans `vite.config.ts`) liste les fichiers produits et écrit `dist/sw.js` à partir de `src/sw-template.js`, avec une version = empreinte SHA-256 du contenu. Stratégie « cache d'abord », requêtes d'autres origines ignorées, anciens caches supprimés à l'activation.

**Conséquences.** + Hors ligne après la première visite, ~30 lignes auditables. − Pas de notification « nouvelle version disponible » : la nouvelle version s'active au prochain lancement.
