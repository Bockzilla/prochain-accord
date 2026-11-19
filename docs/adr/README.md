# Décisions d'architecture (ADR)

Chaque fichier décrit une décision : le contexte, le choix, et ses conséquences.

| # | Décision |
|---|---|
| [001](001-zero-dependance-execution.md) | Zéro dépendance d'exécution, outils de build minimaux |
| [002](002-hebergement-github-pages-csp.md) | GitHub Pages, CSP par balise `<meta>` |
| [003](003-capture-audio-et-clics.md) | AudioWorklet horodaté, FFT maison, évitement des clics du métronome |
| [004](004-doigtes-table-et-generateur.md) | Doigtés : table manuelle + formes mobiles + générateur, validés par tests |
| [005](005-mesures-composees.md) | Signatures composées : groupes de temps, BPM = un cercle |
| [006](006-service-worker-maison.md) | Service worker maison généré au build |
| [007](007-frontieres-pour-la-version-dj.md) | Frontières de modules pour la future version DJ (BEATBOCK) |
| [008](008-rollup-wasm.md) | rollup en WebAssembly (binaire natif bloqué par Windows) |
