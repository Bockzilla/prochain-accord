# ADR 013 — Univers harmonique, mascotte et mondes : SVG + Canvas, sans moteur 3D

**Statut :** accepté — 2026-11-19

**Contexte.** La V3 veut un univers 2,5D, une mascotte expressive et six mondes visuels, sans sacrifier la précision musicale ni la batterie.

**Décision.**
- **Graphe** (`theory/world-graph.ts`, pur) :
  - les voisins de chaque accord sont calculés à la demande (résolution, dominante, relatif, diatoniques, notes communes, emprunts, modulation par accord pivot), donc le monde est cyclique et sans fin ;
  - seule une fenêtre bornée est matérialisée (≤ 19 îlots, ≤ 9 sur téléphone) ;
  - placement en créneaux réguliers, orientés selon le type de relation.
- **Rendu** : SVG (îlots en relief, chemins typés par icône et motif) + Canvas 2D pour les particules. Pas de WebGL : le gain visuel ne justifiait pas le poids ni la consommation.
- **Mascotte** (`mascot/`) :
  - les mouvements sont des fonctions pures de la phase dans le temps ;
  - l'interface lit l'horloge audio (moins la latence d'affichage) et applique la pose ; l'animation suit la musique et ne la pilote jamais ;
  - l'impact du saut tombe exactement sur le temps.
- **Thèmes** (`themes/`) : aucune dépendance musicale. Un thème = design tokens, palette, décor, particules, caractère d'animation, costume, limites de performance. Le lien style → monde est fait dans l'interface.
- **Accessibilité** : contraste vérifié par test, `prefers-reduced-motion` respecté, mode économie.

**Conséquences.**
- \+ Léger (bundle total ~70 Ko compressé), hors ligne, testable.
- − Pas de vraie 3D ; le « 3D doux » est simulé par dégradés, ombres et perspective.
