# ADR 010 — Accompagnement et micro, lecture en arrière-plan

**Statut :** accepté — 2026-11-19

**Contexte.** Sur le haut-parleur, le micro entend l'accompagnement : la détection afficherait les accords de la boucle comme si l'utilisateur les jouait. Une vraie séparation de sources (retirer la boucle du signal du micro) demanderait une annulation d'écho dédiée à la musique, lourde et peu fiable sur téléphone.

**Décision.**
- Accompagnement sur le haut-parleur : la détection est **mise en pause**, avec un message explicite. L'utilisateur peut confirmer qu'il porte des écouteurs (« J'utilise des écouteurs ») : la détection reste alors active.
- Un avertissement recommande les écouteurs dans « Accompagner ».
- Quand la page passe en arrière-plan (écran éteint, autre appli), l'accompagnement se met **en pause** et pourra reprendre à la même mesure. Le navigateur y bride les minuteries, ce qui produirait des trous ; les clics en retard sont déjà rendus muets (ADR 003).
- La file d'affichage du métronome est plafonnée, car l'animation ne tourne pas en arrière-plan.

**Conséquences.**
- \+ Pas de faux accords détectés.
- − Sans écouteurs, on ne peut pas jouer avec la boucle et voir ses accords détectés en même temps.
