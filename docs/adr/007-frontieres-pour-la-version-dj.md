# ADR 007 — Frontières pour la future version DJ (BEATBOCK)

**Statut :** accepté — 2026-11-18

**Décision.**
- `src/theory/` est pur : aucune importation hors du dossier, aucune API navigateur. Il expose déjà `toCamelot` / `fromCamelot` / `camelotNeighbours` et l'estimation de tonalité.
- `src/metronome/` reçoit son horloge par injection (`Clock`) et émet des événements ; il ne connaît ni l'interface ni le micro. Une synchro BPM externe = appeler `update({ bpm })` ou fournir une autre horloge.
- `tests/architecture.test.ts` fait échouer le build si ces frontières sont franchies.

**Conséquences.** La version DJ pourra réutiliser ces deux modules tels quels (ou les extraire en paquet).
