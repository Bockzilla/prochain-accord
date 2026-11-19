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

| Fonction | Statut | Remarque |
|---|---|---|
| Graphe harmonique cyclique et extensible (pur, testé) | TO_BUILD | diatonique, dominantes, relatifs, modulations, notes communes, emprunts, résolutions |
| Fenêtre bornée (pas de nœuds illimités) | TO_BUILD | |
| Rendu 2,5D en îlots, chemins typés | TO_BUILD | |
| Sélection, voisins, retour arrière, recentrage, historique | TO_BUILD | |
| Navigation tactile et souris | TO_BUILD | |
| Suivi de l'accord détecté au micro | TO_BUILD | |

## Phase C — Mascotte

| Fonction | Statut | Remarque |
|---|---|---|
| Personnage original, cartoon doux | TO_BUILD | |
| Saut à chaque temps, numéro du temps, accent du temps 1 | TO_BUILD | sur l'horloge audio |
| Saut vers une autre pastille au changement d'accord | TO_BUILD | |
| Repos / déplacement / célébration | TO_BUILD | |
| Aucune influence sur la précision audio | TO_BUILD | à prouver par test d'architecture |

## Phase D — Mondes musicaux

| Fonction | Statut | Remarque |
|---|---|---|
| Moteur de thèmes indépendant de la musique | TO_BUILD | |
| Blues, Rock, Folk, Country (décor, palette, particules, animation, costume) | TO_BUILD | prioritaires |
| Jazz, Pop (thèmes visuels) | TO_BUILD | sans moteur d'accompagnement dédié |
| Transition sans interrompre l'audio | TO_BUILD | |
| Réduction des animations, mode économie | TO_BUILD | |

## Phase E — Improvisation intelligente

| Fonction | Statut | Remarque |
|---|---|---|
| Détection monophonique des notes | TO_BUILD | même moteur YIN que l'accordeur |
| Toutes les positions possibles d'une hauteur sur le manche | TO_BUILD | la corde exacte n'est pas déductible de la fréquence |
| Hiérarchie visuelle : jouée > accord > position > voisines (±2 cases) > contexte | TO_BUILD | |
| 5 positions pentatoniques distinguées visuellement | TO_BUILD | V2 : une position à la fois |
| Notes cibles qui suivent l'accord de l'accompagnement | TO_BUILD | |
| Explication « pourquoi ces notes » | TO_BUILD | |

## Phase F — Intégration

| Fonction | Statut | Remarque |
|---|---|---|
| Jouer = monde + détection + accordeur | TO_BUILD | |
| Accompagnement audible pendant le monde ou le manche | EXISTS | horloge partagée (V2, testé) |
| Responsive mobile / desktop, tactile | TO_BUILD | |
| Accessibilité (contraste, formes, mouvement réduit) | TO_BUILD | |

## Phase G — Validation

| Fonction | Statut | Remarque |
|---|---|---|
| Tests existants intacts + nouveaux tests | TO_BUILD | |
| Revue visuelle desktop + mobile, 4 mondes, costumes | TO_BUILD | |
| Sécurité (CSP, audit, CodeQL), hors ligne | EXISTS | à re-vérifier |
| Déploiement | TO_BUILD | |

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
