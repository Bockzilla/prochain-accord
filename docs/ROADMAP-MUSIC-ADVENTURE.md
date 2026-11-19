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
| Accordeur : fréquence fondamentale (YIN) | TO_BUILD | | à tester |
| Accordeur : nom de note, écart en cents | TO_BUILD | | |
| Accordeur : grande aiguille animée, zone verte | TO_BUILD | | |
| Accordeur : modes guitare standard / chromatique | TO_BUILD | | |
| Accordeur : A4 configurable (440 Hz par défaut) | EXISTS (réglage) | le réglage existe pour la détection d'accords | |
| Accordeur : rejet des signaux instables | TO_BUILD | | |
| Sélection de l'entrée audio (micro / USB) | EXISTS | V2, choix par `deviceId` ; pas de choix de canal | à tester (PreSonus) |
| Choix du canal d'entrée (interface 2 canaux) | TO_BUILD | | à tester |
| Calibration guidée (silence → accord → analyse → recommandation → application) | TO_BUILD | | à tester |
| Profils RAPIDE / ÉQUILIBRÉ / STABLE | TO_BUILD | à mesurer sur signaux synthétiques | à tester |
| Accompagnement + micro simultanés (casque / interface) | TO_BUILD | V2 : la détection se met en pause sans case « écouteurs » | à tester |
| Comportement explicite sur haut-parleurs | TO_BUILD | | |
| Micro disponible entre les espaces | EXISTS | moteur audio global ; à re-tester | |

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
