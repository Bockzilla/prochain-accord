# ADR 011 — Analyse harmonique prudente, gammes calculées

**Statut :** accepté — 2026-11-19

**Contexte.**
- Une tonalité ambiguë ne doit jamais être présentée comme certaine.
- Am–F–C–G a exactement les mêmes notes en Do majeur et en La mineur.

**Décision.**
- **Vraisemblances :** elles sont calculées par une exponentielle douce des corrélations de Krumhansl.
- **Tonalités relatives :** si les deux meilleures candidates sont relatives, on ne tranche que sur un indice clair : la sensible du mineur (un V majeur, par ex. Mi majeur en La mineur), ou un début et une fin sur la même tonique. Sinon, l'app affiche « ambigu : X ou Y » avec une certitude faible.
- **Cohérence :** « Jouer » et « Comprendre » utilisent la même analyse.
- **Gammes et positions :** elles sont **calculées** à partir des intervalles, jamais écrites tonalité par tonalité. Une position pentatonique = 12 notes consécutives de la gamme, 2 par corde, à partir de la p-ième note sur la corde grave. Les tests vérifient les 12 tonalités, les 5 positions, la transposition et l'égalité entre majeure et relative mineure.
- **Gammes suggérées :** elles couvrent les notes des accords. Un ♭7 dans la progression (I–♭VII–IV, I7) déclenche le **mixolydien** plutôt que le majeur : c'est un test qui a révélé l'erreur.

**Conséquences.** Les explications restent pédagogiques et prudentes, mais un test qui passe ne prouve pas qu'un choix sonne bien : l'écoute réelle reste nécessaire.
