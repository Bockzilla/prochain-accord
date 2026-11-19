# ADR 004 — Doigtés : table + formes mobiles + générateur

**Statut :** accepté — 2026-11-18

**Contexte.** Il faut plusieurs positions par accord (guitare) et au moins 2 (mandoline), pour 12 fondamentales × 7 types, avec des doigtés exacts et jouables.

**Décision.**
- Modèle commun : instrument = cordes accordées (MIDI) + nombre de cases + cordes par chœur. Ajouter un ukulélé = une entrée.
- Ordre de construction : table JSON écrite à la main (accords ouverts) → barré forme Mi → barré forme La → générateur (recherche exhaustive dans une fenêtre de 4 cases).
- Contraintes du générateur : notes **exactes**, écart ≤ 4 cases, ≤ 4 doigts (le barré compte pour un), cordes muettes seulement côté grave, pas de corde à vide au-delà de la 4e case, fondamentale à la basse exigée à la guitare (préférée seulement à la mandoline, où les formes usuelles ne l'ont pas).
- Numéros de doigts calculés (barré à l'index si plus de 4 cordes appuyées).
- **Les tests sont l'arbitre** : chaque position des 84 accords sur guitare et mandoline est vérifiée. Ils ont d'ailleurs attrapé deux erreurs dans la table manuelle (C7 `x32310` sans quinte, Dm mandoline contenant un Do).

**Conséquences.** + Couverture complète et vérifiée. − Les accords à 4 sons sans quinte omise (exigence « notes exactes ») donnent parfois des formes moins usuelles que celles des méthodes de guitare.
