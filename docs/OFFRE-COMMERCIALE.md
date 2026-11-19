# Offre commerciale envisagée

**Statut : tarifs envisagés, aucune facturation.** Ils sont inscrits pour guider l'architecture (comptes, droits d'accès) et la conception de la V4. Rien ne sera facturé avant une V4 validée par de vrais utilisateurs (voir les [critères](ROADMAP-V4.md#critères-de--v4-commercialisable-)).

Prix en **dollars canadiens**, par mois.

| Formule | Prix | Pour qui | Contenu envisagé |
|---|---|---|---|
| **Gratuit** | 0 $ | tout le monde | tout ce qui existe en V1 à V3 (Jouer, accordeur, Improviser, Accompagner, Comprendre, six mondes) + Pratiquer « Premiers pas » ; hors ligne ; sans compte |
| **Solo** *(nom provisoire)* | **7,99 $ CA/mois** | une personne | parcours V4 complet (niveaux, XP, badges, costumes, défis), synchronisation entre appareils |
| **Famille** | **12,99 $ CA/mois** | un foyer | Solo pour plusieurs profils (nombre à fixer, 5 proposé), profils enfants gérés par un parent, défis en famille |
| **Spectacle** | **+3,99 $ CA/mois** | option, sur Solo ou Famille | spectacle virtuel, avatar animé par caméra, partage familial (V4+) |

## Principes proposés

1. **Ce qui est gratuit le reste.** Les fonctions V1 à V3 et l'outil de base (accordeur, détection, métronome, accompagnement) ne passent jamais derrière un paiement. Un utilisateur gratuit n'est pas un utilisateur dégradé.
2. **On paie pour un parcours, pas pour débloquer l'app.** Le payant = progression guidée, contenu, synchronisation, spectacle.
3. **Pas de publicité, pas d'achat dans l'app pour les enfants**, pas d'XP ou de costume à acheter, pas de loot box.
4. **Résiliation aussi simple que l'inscription**, depuis l'app.
5. **Le son et la caméra restent sur l'appareil**, quelle que soit la formule.

## Questions à trancher plus tard

| Question | Options | Remarque |
|---|---|---|
| Affichage des taxes | « 7,99 $ + taxes » | au Québec, TPS + TVQ s'ajoutent (environ 14,975 %) ; vérifier les règles d'affichage du prix avec la Loi sur la protection du consommateur |
| Abonnement annuel | ex. 2 mois offerts | à décider après les premiers abonnés |
| Essai gratuit | 7 ou 14 jours | sans carte bancaire si possible |
| Profils dans Famille | 4, 5 ou 6 | 5 proposé |
| Spectacle sur Famille | un seul supplément pour tout le foyer, ou par profil | un seul proposé (plus simple) |
| Canal de vente | web (ex. Stripe) et/ou Google Play | Google Play impose en général son système de paiement aux applis qu'il distribue (commission ~15 % sur les abonnements) ; une PWA vendue sur le web passe par un prestataire de paiement (~3 % + frais fixes). Chiffres et règles à vérifier au moment venu |
| Autres devises | USD, EUR | plus tard ; prix de référence en $ CA |

## Ordre de mise en place

1. **Maintenant** : rien n'est facturé. L'architecture prévoit des « droits » (formule active) sans aucune logique de paiement.
2. **Bêta comptes** (gratuite) : comptes, profils, synchronisation, testés par la famille et des testeurs.
3. **V4 validée** : facturation en mode test du prestataire, puis lancement payant.
4. **V4+ validée** : option Spectacle.

À faire valider par un professionnel avant le lancement payant : conditions d'utilisation, politique de confidentialité (Loi 25), règles sur les abonnements et les enfants.
