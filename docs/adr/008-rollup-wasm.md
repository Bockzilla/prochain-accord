# ADR 008 — rollup en WebAssembly

**Statut :** accepté — 2026-11-18

**Contexte.** Sur le poste de développement, Windows (contrôle des applications / Smart App Control) bloque le binaire natif `rollup.win32-x64-msvc.node`, ce qui empêche les tests et le build.

**Décision.** `package.json` → `"overrides": { "rollup": "npm:@rollup/wasm-node@4.68.7" }`. Paquet officiel de l'équipe rollup, MIT, une seule dépendance (`@types/estree`).

**Conséquences.** + Fonctionne partout sans binaire natif (aussi en CI Linux). − Build un peu plus lent (imperceptible ici : environ 0,3 s).
