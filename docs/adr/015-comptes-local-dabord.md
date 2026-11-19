# ADR 015 — Comptes : local d'abord, serveur plus tard, sans facturation maintenant

**Statut :** proposé — 2026-11-19 (architecture préparée, rien d'implémenté)

**Contexte.** La V4 (progression, XP) et la V4+ (partage familial) demanderont des comptes, des profils familiaux et des droits payants (tarifs envisagés : [OFFRE-COMMERCIALE](../OFFRE-COMMERCIALE.md)). L'app actuelle n'a ni compte ni serveur, et promet qu'aucune donnée ne quitte l'appareil.

**Décision.**
- **Local d'abord** : toute fonction marche sans compte. Le compte ajoute la synchronisation, le foyer et les droits ; il n'est jamais exigé pour l'outil de base.
- **Journal d'événements en ajout seul** comme format unique de progression, dès Pratiquer (V3.5), en local. XP, badges et niveaux sont recalculés par une fonction pure. La synchronisation = union d'événements à identifiant unique.
- **Pas de mot de passe** : passkeys, lien magique en secours. Pas d'identifiants pour les enfants : profils gérés par un parent.
- **Droits écrits uniquement par le serveur.** L'app lit une copie signée, valable hors ligne pour une durée limitée.
- **Le son et la caméra ne sont jamais envoyés.**
- **Aucune facturation** n'est construite avant une V4 validée en réel. Aucun code de paiement dans le dépôt d'ici là.
- Le choix du serveur fera l'objet d'un ADR séparé (préférence : Postgres géré avec règles d'accès par ligne, hébergé au Canada, appelé par `fetch` pour respecter l'[ADR 001](001-zero-dependance-execution.md)).

**Conséquences.**
- \+ Aucune migration de données le jour où les comptes arrivent ; pas de conflit de synchronisation.
- \+ Les utilisateurs gratuits et hors ligne ne perdent rien.
- − Il faudra élargir la CSP (`connect-src`) et réécrire la phrase « aucun compte » du README au moment de la mise en service.
- − Le recalcul de l'XP à partir du journal coûte un peu plus qu'un compteur (négligeable à l'échelle d'un élève).

Détail : [ARCHITECTURE-COMPTES](../ARCHITECTURE-COMPTES.md).
