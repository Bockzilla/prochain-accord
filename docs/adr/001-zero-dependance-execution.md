# ADR 001 — Zéro dépendance d'exécution

**Statut :** accepté — 2026-11-18

**Contexte.** L'app doit pouvoir être vendue, fonctionner hors ligne et ne rien envoyer sur Internet. Chaque bibliothèque ajoutée est du code tiers à auditer et un risque de chaîne d'approvisionnement.

**Décision.** Aucune dépendance livrée dans l'app. Théorie musicale, FFT, chromagramme, diagrammes SVG, i18n, service worker : code maison, testé. Outils de développement seulement : Vite 7, TypeScript 6, Vitest 5, `@types/node`.

**Conséquences.** + Audit simple (0 paquet livré), bundle de 27 Ko compressé, licence maîtrisée. − Plus de code à maintenir soi-même ; pas de détection d'accords « par IA » prête à l'emploi.
