# Architecture future — comptes, profils familiaux, administration

**Statut : préparée, non implémentée.** Aucune ligne de code serveur, aucun compte, aucune facturation n'existe aujourd'hui. Décision de principe : [ADR 015](adr/015-comptes-local-dabord.md).

## Objectifs

1. L'app reste **utilisable sans compte**, hors ligne, pour toujours (formule Gratuit).
2. Un compte sert à **synchroniser** la progression, gérer un **foyer** et, plus tard, des **droits payants**.
3. **Le son et l'image de la caméra ne sont jamais envoyés.** Le serveur ne reçoit que des données de progression, de profil et d'abonnement.
4. **Minimisation** : le moins de données personnelles possible, surtout pour les enfants.
5. Conforme à la **Loi 25** (Québec) et à la LPRPDE (Canada) dès la conception ; à faire valider par un juriste.

## Modèle de données

```
Compte (titulaire, adulte)            1 ── 1  Foyer
  courriel vérifié, clés d'accès (passkeys)     formule : gratuit | solo | famille
  rôle : membre | admin                         options : [spectacle]
                                                droits calculés par le serveur
Foyer 1 ── n Profil
  Profil : surnom, couleur de Pik, mode d'affichage (Simple / Standard / Grand texte),
           type : adulte | enfant, code PIN facultatif (changement de profil)
           PAS de date de naissance, PAS de photo, PAS de nom complet
Profil 1 ── n Événement de progression
  { id unique (UUID), profil, type, leçon/exercice, résultat, date, version }
  journal en ajout seul : jamais modifié, seulement complété
Profil 1 ── n Partage (V4+)
  objet partagé, destinataires (membres du foyer), expiration, révoqué ?
Journal d'administration
  qui, quoi, quand — chaque action d'un administrateur
```

Pourquoi un **journal d'événements** plutôt qu'un compteur d'XP :
- la synchronisation devient une simple **union** (identifiants uniques, aucun conflit à résoudre) ;
- l'XP, les badges et les niveaux sont **recalculés** par une fonction pure, testable, identique sur l'appareil et le serveur ;
- impossible de « gonfler » son XP en modifiant un chiffre.

Ce format est celui que Pratiquer (V3.5) utilisera dès le départ en local : aucune migration le jour où les comptes arrivent.

## Authentification

| Choix | Raison |
|---|---|
| **Clés d'accès (passkeys / WebAuthn)** en premier | pas de mot de passe à voler ; empreinte ou visage du téléphone |
| **Lien magique par courriel** en secours | pour les appareils sans passkey |
| Pas de mot de passe stocké | rien à fuiter |
| Pas de connexion pour les enfants | un enfant choisit son profil sur l'appareil du foyer ; PIN facultatif posé par le parent |
| Comptes administrateurs : passkey obligatoire + seconde vérification | accès sensibles |

## Côté serveur (options, à décider plus tard)

| Option | Pour | Contre |
|---|---|---|
| **Postgres géré avec règles par ligne** (ex. Supabase) | règles d'accès écrites dans la base (un foyer ne voit que ses lignes), authentification incluse, région Canada à vérifier | service tiers ; client JS = dépendance d'exécution (ou appels `fetch` directs pour respecter l'ADR 001) |
| Firebase | simple, bon hors ligne | données hors Canada par défaut, verrouillage fournisseur |
| Serveur maison (Node + Postgres) | contrôle total | sécurité et maintenance à notre charge |

Recommandation provisoire : **Postgres géré avec règles par ligne, hébergé au Canada**, appelé par `fetch` depuis l'app (zéro dépendance ajoutée). À confirmer par un ADR au moment de construire.

Règles d'accès, quel que soit le choix :
- un utilisateur ne lit et n'écrit que les lignes de **son foyer** ;
- les **droits** (formule active) ne sont **jamais** écrits par l'app : seulement par le serveur, sur notification du prestataire de paiement ;
- les événements sont en **ajout seul** pour l'app (pas de modification ni de suppression individuelle ; la suppression du profil ou du compte efface tout).

## Fonctionnement hors ligne et droits

- L'app garde une copie des droits signée par le serveur, valable **30 jours sans connexion** (durée à fixer).
- Sans compte ou droits expirés : l'app reste en formule Gratuit, **aucune donnée n'est perdue** (le journal local reste sur l'appareil).
- Les événements créés hors ligne partent à la prochaine connexion.

## Administration

| Rôle | Peut | Ne peut pas |
|---|---|---|
| **Propriétaire** | tout, y compris nommer des administrateurs | — |
| **Support** | voir l'état d'un abonnement, le nombre de profils, renvoyer un lien de connexion, rembourser (plus tard) | voir le contenu des profils enfants, les partages, se connecter « à la place » d'un utilisateur |
| **Lecture statistique** | voir des chiffres agrégés (nombre de foyers, rétention) | voir une personne en particulier |

- Console d'administration **séparée de l'app** (autre adresse), jamais livrée aux utilisateurs.
- Chaque action d'administration est inscrite au journal, consultable par le propriétaire.
- Il n'existe aucun enregistrement audio ou vidéo à consulter : ils ne sont jamais envoyés.

## Vie privée (Loi 25) — points à prévoir

- Nommer une **personne responsable de la protection des renseignements personnels** (par défaut : le propriétaire de l'entreprise) et publier son titre et ses coordonnées.
- **Évaluation des facteurs relatifs à la vie privée** avant le lancement, et avant tout hébergement de données hors Québec.
- Consentement clair, séparé pour chaque usage ; consentement d'un parent pour les profils enfants.
- Dans l'app : **exporter mes données**, **supprimer mon compte** (suppression réelle, y compris des sauvegardes après un délai annoncé).
- Registre des incidents de confidentialité.

## Impacts sur l'existant (à traiter le jour venu)

| Élément | Changement |
|---|---|
| [ADR 001](adr/001-zero-dependance-execution.md) zéro dépendance | à conserver via `fetch` ; sinon réviser l'ADR |
| [ADR 002](adr/002-hebergement-github-pages-csp.md) CSP | ajouter le domaine du serveur à `connect-src` |
| README « aucune donnée envoyée, aucun compte » | devient « aucune donnée envoyée **sans compte** ; avec un compte, seule la progression est synchronisée » |
| Service worker | ne jamais mettre en cache les réponses d'authentification ou de droits |
| Dépôt public | aucun secret dans le dépôt ; clés serveur dans les secrets de déploiement |

## Étapes

| Étape | Contenu | Quand |
|---|---|---|
| C0 | Journal d'événements local (Pratiquer) + profils locaux sur un appareil | avec Pratiquer / V4 |
| C1 | Choix du serveur (ADR), comptes, foyer, synchronisation — bêta gratuite | quand la V4 est en test |
| C2 | Droits et facturation, mode test du prestataire seulement | V4 validée |
| C3 | Lancement payant | après validation juridique |
| C4 | Partages familiaux (V4+) | V4+ validée |
