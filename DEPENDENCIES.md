# Registre des dépendances

> **Important — auto-vérification.** Cet audit a été réalisé par l'assistant qui a écrit le code. Ce n'est **pas** une revue de sécurité indépendante. Il vérifie des points concrets et reproductibles (licences, scripts d'installation, appels réseau, versions), mais ne remplace pas l'avis d'un tiers.

Dernière mise à jour : 2026-11-19 (V3 : aucune dépendance ajoutée — univers, mascotte, thèmes, accordeur et détection de notes sont en code maison).

## Résumé

| | |
|---|---|
| Dépendances **d'exécution** (livrées dans l'app) | **0** |
| Dépendances de développement directes | 4 (`vite`, `typescript`, `vitest`, `@types/node`) |
| Paquets installés au total (transitifs inclus) | 34 |
| `npm audit` | 0 vulnérabilité |
| Licences | toutes MIT, Apache-2.0, ISC, BSD-3-Clause ou 0BSD |
| Scripts d'installation exécutés | aucun (`ignore-scripts=true` dans `.npmrc`, `npm ci --ignore-scripts` en CI) |
| CDN à l'exécution | aucun — tout est empaqueté, vérifié par la CSP `default-src 'self'` |

Le bundle final (`dist/assets/index-*.js`, ~215 Ko, 70 Ko compressé, V3 incluse) ne contient que du code maison : aucun `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` ni `new Function` (vérifié par recherche dans le fichier produit et par le test `tests/architecture.test.ts` sur le code source).

## Dépendances retenues (développement uniquement)

| Paquet | Version exacte | Licence | Rôle | Résultat de l'audit |
|---|---|---|---|---|
| `vite` | 7.3.8 | MIT | Serveur de dev, build | Mainteneurs : équipe Vite (Evan You + bot). Branche 7.x maintenue (correctif du 2026-11-09). Code réseau = rechargement à chaud du serveur de dev (WebSocket), jamais livré. Aucun script d'installation. |
| `typescript` | 6.0.3 | Apache-2.0 | Vérification des types | Microsoft. **Zéro dépendance.** Aucun script d'installation. `child_process` présent (tsserver), jamais livré. |
| `vitest` | 5.1.0 | MIT | Tests unitaires | Équipe Vitest (5 mainteneurs). Version publiée le 2026-11-02 ; la 5.1.1 (publiée le jour même de l'audit) a été **volontairement écartée** en attendant qu'elle mûrisse. |
| `@types/node` | 24.19.2 | MIT | Types Node pour les tests | DefinitelyTyped. Fichiers `.d.ts` uniquement (aucun code exécutable). |

### Paquets transitifs notables

| Paquet | Licence | Remarque |
|---|---|---|
| `esbuild` 0.28.2 | MIT | Seul paquet déclarant un `postinstall` (`node install.js`, qui télécharge le binaire depuis `registry.npmjs.org` si le paquet optionnel manque). **Non exécuté** grâce à `--ignore-scripts` ; esbuild fonctionne via son paquet optionnel `@esbuild/win32-x64` / `linux-x64`. |
| `rollup` → **`@rollup/wasm-node` 4.68.7** | MIT | Remplacement imposé par `overrides` dans `package.json` : le binaire natif `rollup.win32-x64-msvc.node` est **bloqué par Windows (Smart App Control)** sur le poste de développement. La version WebAssembly est publiée par la même équipe rollup ; une seule dépendance (`@types/estree`). |
| `postcss`, `nanoid`, `picocolors`, `source-map-js`… | MIT / ISC / BSD-3-Clause | Dépendances classiques de Vite. |
| `detect-libc`, `expect-type` | Apache-2.0 | — |

Liste complète et reproductible : `npm ls --all`, ou le script d'audit décrit ci-dessous.

## Dépendances rejetées

| Candidat | Raison du rejet |
|---|---|
| **Vite 8.x** | Entraîne `lightningcss` sous licence **MPL-2.0** (hors de la liste MIT/Apache/BSD/ISC). Vite 7.3.8 (maintenu) n'en dépend pas → retenu à la place. |
| **TypeScript 7.x** | Nouvelle version native qui tire 20 paquets binaires par plateforme. TypeScript 6.0.3 suffit, sans aucune dépendance. |
| `tonal` (théorie musicale, MIT) | Nécessité non démontrée : la théorie utile (accords, gammes, chiffres romains, Krumhansl, Camelot) tient en ~300 lignes testées dans `src/theory/`. |
| `svguitar` (diagrammes, MIT) | Le rendu SVG maison (`src/render/fretboard-svg.ts`, ~80 lignes) gère X/O, doigts, barrés, gaucher, mandoline, sans `innerHTML` (compatible CSP stricte). |
| `Meyda` (analyse audio, MIT) | La FFT radix-2 + chromagramme maison font ~150 lignes et sont testés avec des signaux synthétiques. |
| `Essentia.js` | Licence **AGPL-3.0** : exclue d'office (incompatible avec une vente de l'app sans publier le code). |
| Bibliothèques de batterie, échantillons audio, Tone.js | V2 : l'accompagnement est synthétisé en Web Audio (environ 200 lignes) ; aucun fichier audio, aucune API payante, aucun contenu protégé. |
| `vite-plugin-pwa` / Workbox | Arbre de dépendances important pour un besoin simple : service worker maison (`src/sw-template.js`, ~30 lignes) généré au build. |

## Comment l'audit a été fait (reproductible)

1. `npm view <paquet> version license maintainers time` pour chaque candidat (popularité, maintenance, date de publication).
2. Installation avec `--ignore-scripts`, puis lecture de **chaque** `package.json` installé : licence + scripts `preinstall` / `install` / `postinstall`.
3. Recherche dans le code **publié sur npm** (dossier `node_modules`, pas le dépôt GitHub) de : `fetch(`, `XMLHttpRequest`, `WebSocket`, `http(s).request/get`, `eval(`, `new Function(`, `document.cookie`, `child_process`. Résultats : uniquement des usages attendus d'outils de build (serveur de dev, lancement de processus), aucun code obfusqué livré.
4. Vérification que le bundle produit (`dist/`) ne contient aucun appel réseau.
5. `npm audit` : 0 vulnérabilité. En CI : `npm audit --audit-level=high` **et** OSV-Scanner (qui échoue à la moindre vulnérabilité connue, plus strict), Dependabot (avec délai de 7 jours avant de proposer une nouvelle version) et CodeQL.

## Verrouillage

- Versions exactes (`save-exact=true`), `package-lock.json` commité.
- Installation : `npm ci --ignore-scripts`.
- Actions GitHub épinglées par SHA de commit (pas par tag modifiable).
