# Feuille de route — Prochain Accord

Document maître. Il dit **dans quel ordre** les choses arrivent et **à quelle condition** on passe à l'étape suivante. Le détail vit dans les documents liés.

| Étape | Contenu | État | Détail |
|---|---|---|---|
| V1–V2 | Détection d'accords, métronome, Jouer / Improviser / Accompagner / Comprendre | en ligne | [README](../README.md) |
| **V3** Music Adventure | Accordeur, profils, calibration, monde harmonique, Pik, six mondes, improvisation guidée | **en ligne — étiquette `v3.0.0`** ; validation réelle en cours | [ROADMAP-MUSIC-ADVENTURE](ROADMAP-MUSIC-ADVENTURE.md) |
| **V3.5** Pratiquer | Nouvel espace pour débutants de tous âges | **prochaine phase** — conçue ci-dessous, non développée | ce document |
| V4 | Progression pédagogique, XP, récompenses, costumes, défis | documentée, **ne pas développer** | [ROADMAP-V4](ROADMAP-V4.md) |
| V4+ | Spectacle virtuel, avatar animé par caméra, partage familial | documentée, **ne pas développer** | [ROADMAP-V4](ROADMAP-V4.md#v4--spectacle-et-famille) |
| Comptes | Comptes sécurisés, profils familiaux, administration | architecture préparée, **rien d'implémenté** | [ARCHITECTURE-COMPTES](ARCHITECTURE-COMPTES.md), [ADR 015](adr/015-comptes-local-dabord.md) |
| Offre | Gratuit, 7,99 $ CA, Famille 12,99 $ CA, Spectacle +3,99 $ CA | tarifs envisagés, **aucune facturation** | [OFFRE-COMMERCIALE](OFFRE-COMMERCIALE.md) |

## Règles de passage

1. **La qualité musicale passe avant les fonctions.** On ne construit pas sur une détection qui n'a pas été validée avec une vraie guitare.
2. **Une étape commence quand la précédente est validée en réel**, pas seulement par les tests automatiques.
3. **Pas de monétisation avant une V4 validée par de vrais utilisateurs.** Les tarifs sont inscrits pour guider l'architecture, pas pour facturer.
4. Ce qui est gratuit aujourd'hui (V1 à V3) **reste gratuit** (principe proposé, voir l'offre).
5. Le son, et plus tard l'image de la caméra, **ne quittent jamais l'appareil**.

## Étape en cours — Validation réelle de la V3

| Point | État | Comment |
|---|---|---|
| Version déployée préservée | fait | étiquette Git `v3.0.0` sur `5f4398d` ; build local identique aux fichiers en ligne (`index-B5hSd7fM.js`, `index-hUzRL3S0.css`) |
| Test rapide (accordeur, Pik, notes, accompagnement) | **à faire par l'utilisateur** | [TEST-GUITARE-RAPIDE](TEST-GUITARE-RAPIDE.md), 15 min |
| Protocole complet | à faire ensuite | [TEST-PROTOCOL](TEST-PROTOCOL.md), 30 min |
| Corrections des problèmes rapportés | en attente des résultats | une fiche problème = une correction + un test automatique quand c'est possible |

**Critère de sortie de la V3** (proposé) : test rapide entièrement OK, ou chaque PAS OK corrigé puis re-testé ; au moins 5 accords justes sur 6 en pièce calme ; Pik jugé « synchro » avec le clic.

**Revenir à la V3 publiée** si une correction pose problème :
- Reconstruire localement : `git checkout v3.0.0`, puis `npm ci --ignore-scripts && npm run build` redonne exactement les mêmes fichiers.
- Remettre en ligne, voie rapide (moins de 30 jours après le run) : relancer le run CI de l'étiquette (`gh run rerun 44468300297`), qui reconstruit et republie `5f4398d`. Attention, le prochain `push` sur `main` republiera `main`.
- Voie durable : `git revert` des commits fautifs sur `main`, puis `push` (la CI republie).

## V3.5 — Pratiquer

### Pourquoi

Les quatre espaces actuels supposent qu'on sait déjà tenir une guitare et faire quelques accords. **Pratiquer** accueille ceux qui commencent, de 6 à 99 ans : une chose à la fois, l'app écoute et confirme, Pik encourage.

### Principes

- **Une seule consigne à l'écran**, un gros bouton, une réponse claire.
- **L'app écoute pour de vrai** : la réussite est confirmée par la détection existante (accords) et l'accordeur YIN (notes). Rien n'est « validé » au hasard.
- **Honnête quand elle doute** : si la détection n'est pas sûre, l'app dit « je n'ai pas bien entendu, rejoue » — jamais « c'est faux ». Un débutant ne doit pas être puni pour une erreur de l'app.
- **Séances courtes** (5 à 10 min), reprise là où on s'est arrêté.
- **Pas d'âge demandé** : un réglage d'affichage suffit (voir plus bas). Aucune donnée personnelle.
- **Hors ligne, sans compte.** La progression reste dans le navigateur (cases cochées). Pas d'XP ni de récompenses : c'est la V4.
- **Contenu original** : exercices et petites grilles composés pour l'app ; mélodies du domaine public seulement (ex. *Au clair de la lune*), arrangements originaux.

### Affichage selon la personne

| Mode | Pour qui | Différences |
|---|---|---|
| **Simple** | jeunes enfants, ou qui préfère | phrases de 6 mots au plus, icônes, Pik parle, très gros boutons, séance de 5 min |
| **Standard** | ados, adultes | courtes explications (« pourquoi »), schémas |
| **Grand texte** | vue fatiguée, seniors | texte agrandi, contraste renforcé, tempo de départ lent, aucune limite de temps |

Au premier lancement, une question : **« Je débute »** (ouvre Pratiquer) ou **« Je joue déjà »** (ouvre Jouer). Modifiable dans les réglages.

### Parcours « Premiers pas » (10 leçons)

| # | Leçon | L'app vérifie avec | Moteur réutilisé |
|---|---|---|---|
| 1 | Tenir la guitare, le médiator, la main gauche | rien (illustrations, Pik montre) | mascotte |
| 2 | Accorder, corde par corde (« joue la corde 6 ») | accordeur | `detection/pitch` |
| 3 | Première note : Mi grave à vide | hauteur de la note | `detection/pitch` |
| 4 | Trois notes sur une corde (cases 0, 1, 3) | hauteur de chaque note | `detection/pitch` |
| 5 | Premier accord : **Em** (2 doigts) | accord détecté | `detection/` |
| 6 | **Am** puis **E** | accord détecté | `detection/` |
| 7 | Changer **Em ↔ Am** lentement (60 BPM, 4 temps par accord) | bon accord dans chaque mesure | `detection/` + `metronome/` |
| 8 | Gratter vers le bas sur chaque temps | régularité des attaques | **nouveau : détection d'attaques** (à mesurer) |
| 9 | **G, C, D** et la grille G – C – D | accords + changements | `detection/` + `metronome/` |
| 10 | Première chanson : grille originale avec accompagnement Folk lent | accords pendant la boucle | `accompaniment/` |

### Types d'exercices (moteur commun)

Cinq types suffisent pour tout le parcours, et pour la V4 :

1. **Joue cette note** — réussi si la bonne hauteur est tenue ~0,5 s (±50 cents : tolérant).
2. **Joue cet accord** — réussi si l'accord est reconnu dans les 4 s.
3. **Change d'accord en mesure** — réussi si chaque accord est reconnu dans sa mesure, X fois de suite.
4. **Gratte en rythme** — attaques à ±80 ms du temps (seuil à mesurer en réel).
5. **Joue avec la boucle** — pourcentage de mesures où l'accord joué est le bon.

Chaque exercice = des **données** (consigne, cible, tolérance, tempo) + une **machine à états pure**, testable avec les signaux synthétiques existants.

### Phases

| Phase | Contenu | Statut |
|---|---|---|
| P0 | Pré-requis : V3 validée en réel ; mesurer la détection sur un jeu « débutant » (cordes étouffées, frisées, attaque faible) | TO_BUILD |
| P1 | Module pur `src/practice/` : leçons en données, machine à états, tolérances ; tests | TO_BUILD |
| P2 | Espace Pratiquer (5ᵉ onglet), leçons 1 à 7, modes d'affichage, progression locale | TO_BUILD |
| P3 | Détection d'attaques pour le rythme (leçon 8), mesurée sur vraie guitare | TO_BUILD |
| P4 | Leçons 9 et 10, accompagnement Folk lent simplifié | TO_BUILD |
| P5 | Test réel avec au moins un enfant, un adulte débutant et une personne âgée | TO_BUILD |

### Critères d'acceptation

- Un vrai débutant termine les leçons 1 à 7 **sans aide extérieure**.
- Moins d'une fausse « réussite » et moins d'un faux « rejoue » sur 10 essais, mesurés en réel (pas seulement en synthétique).
- Utilisable en mode Simple par un enfant qui lit peu.
- Tout fonctionne hors ligne ; aucune donnée ne quitte l'appareil.

### Architecture

- `src/practice/` : pur (pas d'interface, pas d'API navigateur), comme `theory/` ; vérifié par `tests/architecture.test.ts`.
- `src/ui/practice-view.ts` : affichage ; branche la détection, l'accordeur, le métronome et Pik existants.
- Progression : `localStorage`, clé versionnée, sous forme d'**événements** (« leçon 5 réussie le … ») plutôt que d'un simple compteur. Ce format servira tel quel à l'XP (V4) et à la synchronisation des comptes (voir [ARCHITECTURE-COMPTES](ARCHITECTURE-COMPTES.md)).
- Zéro dépendance ajoutée.

### Hors périmètre de Pratiquer

XP, badges, costumes à gagner, défis, comptes, profils multiples synchronisés, paiement : tout cela est en V4 ou plus tard.
