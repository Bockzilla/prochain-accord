# ADR 009 — Accompagnement branché sur l'horloge du métronome

**Statut :** accepté — 2026-11-19

**Contexte.** Batterie, basse et accords doivent rester synchronisés avec le métronome, sans dérive, et pouvoir gagner en réalisme plus tard.

**Décision.**
- Trois couches :
  - `accompaniment/patterns.ts` : motifs rythmiques **originaux**, décrits temps par temps et adaptés à n'importe quelle mesure ;
  - `accompaniment/arranger.ts` : couche pure qui reçoit les événements du métronome et calcule l'heure exacte de chaque note ;
  - `accompaniment/band.ts` : sons synthétisés en Web Audio, sans aucun fichier audio.
- L'arrangeur écoute **le même planificateur** que le métronome : une note = l'heure du temps + une fraction de période, avec le swing (2/3) pour le blues.
- Chaque source audio et ses nœuds (enveloppe, filtre) sont suivis, puis débranchés à la fin de la note ; **Arrêt** coupe aussi les notes déjà planifiées. Un test avec un faux contexte audio vérifie qu'il ne reste aucun nœud.
- Pendant la boucle, le clic a son propre volume (coupé par défaut), mais le décompte reste toujours audible.
- La tonique partagée est conservée quel que soit le mode : choisir « La » donne un blues en La, et non dans la relative.

**Conséquences.**
- \+ La synchronisation est garantie par construction (même horloge, mêmes événements).
- \+ Pour plus de réalisme, il suffit de remplacer les motifs ou les sons.
- − Le son est volontairement simple (synthèse légère) et les motifs sont pensés en 4 temps.
