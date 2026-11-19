# Roadmap — Prochain Accord V3 « Music Adventure »

Document vivant, mis à jour pendant l'implémentation.

**Statuts**
- `EXISTS` : présent dans le code, pas (encore) re-vérifié pour la V3.
- `TO_BUILD` : à construire.
- `IN_PROGRESS` : en cours.
- `TESTED` : couvert par des tests automatiques ou une vérification en navigateur.
- `BLOCKED` : impossible ici, avec la raison.
- `DEFERRED` : reporté explicitement.

**Règle :** « TESTED » ne veut pas dire « validé musicalement ». Toute validation avec une vraie guitare, un vrai téléphone ou une vraie interface audio reste à faire par l'utilisateur (colonne « Réel »).

Point de départ inspecté le 2026-11-19 : commit `913efce` (V2), 144 tests au vert, aucune issue ouverte.

**Version publiée : `v3.0.0`** (étiquette Git sur `5f4398d`, 2026-11-19). Re-vérifié le 2026-11-19 : 189 tests au vert, types OK, CI et CodeQL au vert, build local identique aux fichiers en ligne.

**Validation réelle : en cours.** Procédure : [test rapide 15 min](TEST-GUITARE-RAPIDE.md), puis [protocole complet](TEST-PROTOCOL.md). Les résultats remplissent la colonne « Réel » ci-dessous. La suite (Pratiquer, V4, V4+) est dans la [feuille de route maître](ROADMAP.md).

## Validation réelle — journal

| Date | Appareil / micro | Test | Résultat | Suite donnée |
|---|---|---|---|---|
| — | — | en attente des premiers résultats | — | — |

## Phase A — Fiabilité audio

| Fonction | Statut | Preuve / remarque | Réel |
|---|---|---|---|
| Accordeur : fréquence fondamentale (YIN maison) | TESTED | `tests/pitch.test.ts` : 6 cordes à moins de 1 cent, sans erreur d'octave ; Mi2 à Mi5 avec bruit à moins de 3 cents | à tester |
| Accordeur : nom de note, écart en cents | TESTED | navigateur : note de test Ré3 −20 cents → « D3, −20 cents » ; La2 +30 → « +30 » | |
| Accordeur : grande aiguille animée, zone verte ±5 cents | TESTED | navigateur : aiguille à −24° pour −20 cents ; état « Juste ✓ » à 0 cent | animation à voir |
| Accordeur : modes guitare standard / chromatique | TESTED | tests (corde visée) + navigateur (corde surlignée) | |
| Accordeur : A4 configurable (440 Hz par défaut) | TESTED | test 432 Hz ; réglage dans l'accordeur | |
| Accordeur : rejet des signaux instables | TESTED | tests (hauteur qui saute, accord, silence) ; navigateur : accord Do-Mi-Sol rejeté | |
| Sélection de l'entrée audio (micro / USB) | EXISTS | V2, par `deviceId`, avec repli si l'appareil a disparu | à tester (PreSonus) |
| Choix du canal d'entrée (interface 2 canaux) | IN_PROGRESS | worklet : canal 1, canal 2 ou mélange ; nombre de canaux reçus affiché. Non testable sans interface | à tester |
| Calibration guidée (5 étapes réelles) | TESTED (logique) | `tests/profiles.test.ts` : qualité, profil, conseils, sensibilité. L'assistant mesure vraiment silence puis accord | à tester |
| Profils RAPIDE / ÉQUILIBRÉ / STABLE | TESTED | **mesuré** sur signaux synthétiques : délai d'affichage RAPIDE 221–280 ms, ÉQUILIBRÉ 452–552 ms, STABLE 720–781 ms ; oscillation Am/C toutes les 250 ms : RAPIDE suit (16 changements), ÉQUILIBRÉ et STABLE tiennent (1). Bruit fort avec rafales : les 3 tiennent l'accord | à tester |
| Accompagnement + micro simultanés (casque / interface) | TESTED (logique) | la détection ne se met plus en pause : sortie « casque » ou « interface » = détection pleine | à tester |
| Comportement explicite sur haut-parleurs | TESTED (logique) | détection active ; un accord identique à celui de la boucle est signalé « ≈ accompagnement » et n'entre pas dans l'historique ; annulation d'écho du navigateur en option (imparfaite, dit comme tel) | à tester |
| Micro disponible entre les espaces | TESTED (logique) | bouton micro global dans l'en-tête ; micro rouvert au premier geste si voulu | |

Constats de la phase A :
- Le premier réglage de STABLE (marge de bruit ×3,5, maintien strict de 600 ms) **n'affichait plus rien** dans le bruit. Corrigé avec une marge de ×2,5 et une tolérance aux coupures brèves (250 ms).
- Dans mes signaux synthétiques, les rafales de bruit ne départagent pas les profils. Ce qui les distingue réellement, c'est le délai d'affichage et la tenue face aux fluctuations rapides.

## Phase B — Univers harmonique

| Fonction | Statut | Preuve / remarque | Réel |
|---|---|---|---|
| Graphe cyclique et extensible (pur) | TESTED | `tests/world-graph.test.ts` : chaque relation vérifiée pour tout accord et toute tonalité ; retour possible au départ ; l'exploration atteint les 12 fondamentales et les 12 tonalités | |
| Relations : diatonique, dominante, résolution, relatif, notes communes, emprunt, modulation (accord pivot) | TESTED | idem ; exemples G → C (résolution), C → Am (relatif), C → B♭ (emprunt) | |
| Fenêtre bornée | TESTED | au plus 19 îlots (centre + 8 voisins + 10 en aperçu) ; 9 au plus sur téléphone | |
| Rendu 2,5D, chemins typés (icône + motif de trait) | TESTED (visuel) | revue en desktop et mobile ; îlots répartis en créneaux réguliers, sans chevauchement | à juger |
| Sélection, retour, recentrage, historique | TESTED | navigateur : Am → E7 (dominante) → Am (résolution), puis Retour → E7 ; historique cliquable | |
| Navigation tactile et souris (toucher, glisser) | IN_PROGRESS | événements pointeur ; glissement vérifié par le code, pas sur un vrai écran tactile | à tester |
| Le monde suit l'accord détecté au micro | TESTED | navigateur : signal de test C → G → Am, le monde suit (historique Am → C → G → Am) | à tester |
| Le monde suit l'accompagnement | TESTED (logique) | change d'îlot à chaque changement d'accord de la boucle (micro coupé) | animation à voir |

## Phase C — Mascotte « Pik »

| Fonction | Statut | Preuve / remarque | Réel |
|---|---|---|---|
| Personnage original (médiator vivant, cartoon doux) | TESTED (visuel) | galerie `#galerie` | à juger |
| Saut à chaque temps, impact exactement sur le temps, accent du temps 1 | TESTED (logique) | `tests/mascot-themes.test.ts` (pose à la phase 0, saut plus haut avant le temps 1) | **animation non vue** |
| Numéro du temps au-dessus de la tête, accentué au temps 1 | IN_PROGRESS | code relié aux événements visuels du métronome ; non observé en mouvement (voir limite) | à voir |
| Saut vers l'îlot suivant au changement d'accord | TESTED (logique) | décolle au temps suivant si le métronome tourne ; filet de sécurité si l'animation est suspendue | à voir |
| Repos (respiration, clignement), célébration (résolution vers la tonique, bon accord joué sur la boucle) | IN_PROGRESS | code + test des poses ; non observé en mouvement | à voir |
| Aucune influence sur la précision audio | TESTED | test d'architecture : `mascot/` et `themes/` n'importent aucun module audio et ne lisent pas l'horloge | |

**Limite de vérification.** Le panneau navigateur de l'app était masqué pendant toute la session, et Chrome n'y lance aucune image d'animation (`requestAnimationFrame`). Les poses sont testées, et les images fixes ont été revues, mais **je n'ai pas vu Pik bouger en musique**.

## Phase D — Mondes musicaux

| Fonction | Statut | Preuve / remarque | Réel |
|---|---|---|---|
| Moteur de thèmes indépendant de la musique | TESTED | test d'architecture (`themes/` sans dépendance musicale) | |
| Blues, Rock, Folk, Country : décor, palette, textures, éclairage, îlots, chemins, particules, animation, costume, accents d'interface | TESTED (visuel) | revue des 4 mondes en desktop et en mobile, et des costumes en grand (galerie) ; corrigé : guitare de Pik cachée en Folk, feu de camp sous un îlot | à juger |
| Jazz, Pop (thèmes visuels) | TESTED (visuel) | sans moteur d'accompagnement dédié (dit dans les réglages) | |
| Caractères d'animation distincts | TESTED | 6 mouvements différents (Rock énergique sans balancement, Blues swing…) | à voir |
| Contraste des accents et des étiquettes | TESTED | test WCAG ; corrigé : texte blanc sur rouge Rock (3,5:1 → 5,7:1), îlots Folk, flancs Pop | |
| Transition sans interrompre l'audio | TESTED (logique) | le changement de monde ne touche que le DOM ; fondu du décor | |
| Mouvement réduit, mode économie | TESTED (logique) | `prefers-reduced-motion` : particules et animations coupées ; mode économie : particules ÷ 3 | |

## Phase E — Improvisation intelligente

| Fonction | Statut | Preuve / remarque | Réel |
|---|---|---|---|
| Détection monophonique (YIN + suivi stabilisé) | TESTED | tests + navigateur : La3 +6 cents reconnu ; un accord ne produit aucune note | à tester |
| Toutes les positions possibles d'une hauteur | TESTED | La3 = 4 positions (cases 17, 12, 7, 2) ; la corde exacte n'est jamais « devinée » | |
| Hiérarchie : jouée > accord > position > voisines (±2 cases) > contexte | TESTED | test + navigateur (12 / 10 / 26 notes selon les niveaux) | |
| 5 positions distinguées (règle colorée et numérotée) | TESTED (visuel) | revue mobile | |
| Notes cibles qui suivent l'accord de l'accompagnement | TESTED (logique) | test « Am → F » ; mise à jour à chaque changement d'accord de la boucle | à voir en direct |
| Explication « pourquoi ces notes » | TESTED | texte des notes cibles, y compris les notes de l'accord hors gamme | |
| Note hors gamme signalée | TESTED | navigateur : La♯3 → « hors gamme : à utiliser en passage » | |

## Phase F — Intégration

| Fonction | Statut | Remarque |
|---|---|---|
| Jouer = Monde + Accordeur, détection dessous | TESTED | les cartes vides n'apparaissent qu'au premier accord |
| Micro global (bouton dans l'en-tête), entre les espaces | TESTED (logique) | |
| Responsive mobile / desktop | TESTED (visuel) | disposition compacte du monde sous 640 px ; aucun défilement horizontal de la page |
| Performance | TESTED | mesuré (ordinateur) : analyse d'accord 0,5 ms par trame ; YIN 0,65 ms après décimation (3,4 ms avant) ; fenêtre du monde 0,1 ms. Animations et particules seulement quand le monde est visible |

## Phase G — Validation

| Fonction | Statut | Remarque |
|---|---|---|
| Tests | TESTED | 189 tests (15 fichiers), tous au vert ; 144 en V2, aucun cassé |
| Sécurité (CSP, audit npm, OSV, CodeQL), zéro dépendance ajoutée | TESTED | aucune nouvelle dépendance ; CodeQL relancé en CI |
| Hors ligne | TESTED | service worker inchangé (correctif V2 conservé) |
| Déploiement | TESTED | GitHub Pages, CI + CodeQL au vert, 0 alerte de code, 0 alerte Dependabot ; version en ligne vérifiée (HTTPS, CSP, service worker, 11 fichiers en cache) |

## Reporté explicitement (DEFERRED)

| Fonction | Raison |
|---|---|
| Moteurs d'accompagnement Jazz et Pop | Thèmes visuels prêts ; motifs rythmiques et harmonie jazz (II-V-I, swing, accords enrichis) à concevoir |
| Suppression parfaite de l'accompagnement dans le micro (haut-parleur) | Impossible de façon fiable dans un navigateur : comportement explicite + annulation d'écho optionnelle à la place |
| Corde exacte d'une note jouée | Impossible à partir de la seule fréquence ; on affiche toutes les positions possibles |
| Moteur 3D (WebGL) | Non justifié : le rendu SVG/Canvas 2,5D suffit, plus léger pour la batterie |

## Acquis V1–V2 conservés

| Fonction | Statut |
|---|---|
| Détection d'accords (24 + étendus), stabilisation, évitement des clics | TESTED (synthétique) |
| Doigtés guitare / mandoline / piano | TESTED |
| Métronome (planification, TAP, mesures, entraînement) | TESTED |
| Accompagnement 4 styles calé sur le métronome | TESTED |
| Gammes, 5 positions, cercle des quintes, analyse prudente | TESTED |
| i18n fr / en / es | TESTED |
| Hors ligne (service worker) | TESTED (serveur coupé) |
