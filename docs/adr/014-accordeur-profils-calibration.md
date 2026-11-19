# ADR 014 — Accordeur YIN, profils mesurés, calibration, entrées audio

**Statut :** accepté — 2026-11-19

**Décision.**
- **Hauteur** : YIN maison (`detection/pitch.ts`), avec décimation par 2 au-delà de 32 kHz (5× moins de calcul, précision inchangée dans les tests). Il sert à la fois à l'accordeur et au suivi des notes en improvisation.
- **Accordeur** : il n'affiche une lecture qu'après plusieurs mesures concordantes (médiane, dispersion ≤ 25 cents). L'aiguille est lissée. « Juste » = ±5 cents et lecture stable.
- **Profils** RAPIDE / ÉQUILIBRÉ / STABLE : taille de fenêtre, durée de maintien, confiance minimale, marge de bruit, tolérance aux coupures brèves. Les valeurs ont été choisies **après mesure** (`tests/profiles.test.ts`). Le premier réglage de STABLE n'affichait plus rien dans le bruit : corrigé.
- **Calibration** : silence mesuré → accord mesuré → rapport signal/bruit et netteté → profil et sensibilité recommandés → application (et plancher de bruit initialisé).
- **Entrées** : choix de l'appareil (`deviceId`) et du canal (entrée 1, entrée 2 ou mélange), pour les interfaces à deux entrées comme une PreSonus. Le nombre de canaux réellement reçus est affiché.
- **Accompagnement + micro** :
  - avec un casque ou une interface, la détection reste pleinement active ;
  - sur haut-parleur, elle continue, mais un accord identique à celui de la boucle est signalé « ≈ accompagnement » et n'entre pas dans l'historique ;
  - l'annulation d'écho du navigateur est proposée en option, présentée comme imparfaite.

**Conséquences.** Les profils et l'accordeur sont validés sur signaux synthétiques. Leur comportement réel (guitare, micro de téléphone, PreSonus) reste à mesurer : voir le protocole de test.
