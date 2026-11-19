# V4 et V4+ — vision documentée, non développée

**Statut : documentation seulement.** Rien de ce fichier n'est à développer tant que la V3 n'est pas validée en réel et que Pratiquer (V3.5) n'a pas été testé par de vrais débutants. Voir les [règles de passage](ROADMAP.md#règles-de-passage).

Tarifs envisagés : [OFFRE-COMMERCIALE](OFFRE-COMMERCIALE.md). Comptes et profils : [ARCHITECTURE-COMPTES](ARCHITECTURE-COMPTES.md).

## V4 — Progresser

Objectif : transformer Pratiquer en **parcours qui donne envie de revenir**, sans manipuler personne, enfant ou adulte.

### 1. Progression pédagogique

Un parcours en niveaux, chacun relié à un **monde** existant (les décors et costumes de la V3 servent enfin de carte de progression) :

| Niveau | Compétences | Monde |
|---|---|---|
| 1 Premiers pas | = Pratiquer (V3.5) | Folk |
| 2 Accords ouverts | C, G, D, A, E, Am, Em, Dm ; changements à 60 → 90 BPM | Folk |
| 3 Rythme | grattages bas / haut, croches, régularité | Country |
| 4 Blues | 12 mesures, A7 / D7 / E7, pentatonique mineure, position 1 | Blues |
| 5 Rock | power chords, étouffé (palm mute), riffs simples | Rock |
| 6 Barrés | F, Bm, formes mobiles | Rock / Pop |
| 7 Improvisation | 5 positions pentatoniques, notes cibles sur l'accord | Blues |
| 8 Jazz (plus tard) | accords 7, II-V-I | Jazz (exige le moteur d'accompagnement jazz, aujourd'hui reporté) |

Chaque compétence est **mesurée** par les exercices de Pratiquer (notes, accords, changements par minute, régularité rythmique), pas déclarée par l'élève.

### 2. XP

- On gagne de l'XP pour un **exercice réussi**, pas pour du temps passé l'app ouverte.
- Le gain baisse quand on répète un exercice déjà maîtrisé : on encourage à avancer, pas à « farmer ».
- L'XP est **calculée** à partir du journal d'événements de Pratiquer (fonction pure, testable, facile à synchroniser) ; elle n'est jamais stockée comme un chiffre modifiable.
- Pas d'XP à acheter. Jamais.

### 3. Récompenses

- **Badges** de compétence (« 10 changements Em-Am d'affilée à 80 BPM »), lisibles, sans hasard.
- **Déblocages** : nouveaux mondes, grilles d'accompagnement, costumes.
- **Série douce** : la série de jours compte, mais deux « jours de repos » par semaine ne la cassent pas. Aucun message culpabilisant.
- Pas de coffre au hasard (loot box), pas de compte à rebours, pas de publicité.

### 4. Costumes de Pik

- Extension du système de costumes existant (`themes/`) : chapeaux, guitares, tenues par monde.
- **Gagnés en jouant**, purement cosmétiques, sans effet sur la musique.
- Les costumes des six mondes de la V3 restent disponibles pour tous.

### 5. Défis

- **Défi du jour** (2 à 5 min) et **défi de la semaine**, tirés des compétences en cours.
- Exemples : « Em → Am 10 fois à 70 BPM », « tiens la pentatonique sur un tour de blues sans note hors gamme ».
- Défis **en famille** sur un même appareil (chacun son profil local) ; les défis à distance attendent le partage familial (V4+).

### Pré-requis techniques de la V4

1. Profils locaux sur un même appareil (sans compte) : prénom ou surnom, Pik coloré, mode d'affichage.
2. Journal d'événements de Pratiquer stable et versionné.
3. Détection d'attaques (rythme) validée en réel.
4. Mesures réelles : taux de fausses réussites et faux échecs < 10 % sur les exercices notés.

### Critères de « V4 commercialisable »

- Au moins 10 testeurs (dont enfants et adultes débutants) suivent le parcours 2 semaines.
- La majorité revient au moins 3 fois par semaine **sans rappel insistant**.
- Aucun exercice noté ne frustre à cause d'une erreur de détection (retours des testeurs).
- Comptes et synchronisation prêts (voir [ARCHITECTURE-COMPTES](ARCHITECTURE-COMPTES.md)), facturation testée en mode test uniquement.

## V4+ — Spectacle et famille

### 1. Spectacle virtuel

- On choisit une grille et un monde ; le monde devient une **scène** (lumières, public stylisé).
- Le public réagit à ce que l'app **entend** : accords justes, régularité, fin de morceau.
- Enregistrement du spectacle : le son reste local ; export d'une **vidéo** (scène + son) que l'utilisateur décide de garder ou de partager.

### 2. Avatar animé par caméra

- La caméra suit les mouvements du joueur (tête, épaules, bras) et anime **un avatar** (Pik ou un personnage personnalisé) qui joue sur scène.
- **L'image de la caméra ne quitte jamais l'appareil** : seul l'avatar est rendu, enregistré ou partagé. Par défaut, aucune vraie image de la personne n'est jamais enregistrée.
- Faisabilité à mesurer avant tout engagement :
  - estimation de pose sur téléphone milieu de gamme (fluidité, chauffe, batterie) **en même temps** que l'analyse audio ;
  - un modèle de pose ajoute du poids (plusieurs Mo) et sans doute une dépendance d'exécution : cela exigerait de réviser l'[ADR 001](adr/001-zero-dependance-execution.md) et de vérifier la licence (MIT, Apache, BSD ou ISC seulement) ;
  - nouvelle permission (caméra), à expliquer clairement ; le README promet aujourd'hui « pas de caméra », à mettre à jour le jour venu.

### 3. Partage familial

- Partager un spectacle ou un badge **uniquement avec son cercle familial** (pas de public, pas de recherche, pas de commentaires libres pour les enfants : réactions par émojis).
- Exige les comptes et le foyer décrits dans [ARCHITECTURE-COMPTES](ARCHITECTURE-COMPTES.md).
- Liens de partage privés, révocables, avec expiration.
- Le parent contrôle tout ce que partage un profil enfant.

### Offre associée

Le spectacle, l'avatar et le partage correspondent à l'option **Spectacle (+3,99 $ CA/mois)** ; voir [OFFRE-COMMERCIALE](OFFRE-COMMERCIALE.md).

### Risques V4+

| Risque | Parade envisagée |
|---|---|
| Téléphone trop lent pour caméra + audio | mesurer d'abord ; avatar en option ; mode « avatar figé » |
| Images d'enfants | avatar seulement, jamais la vidéo réelle par défaut ; partage limité au foyer |
| Coût de stockage des vidéos | durée limitée, résolution limitée, suppression automatique des partages expirés |
| Lois sur la vie privée (Québec, Canada, autres pays) | évaluation des facteurs relatifs à la vie privée avant lancement ; avis juridique |
