# Prochain Accord

Application web progressive (PWA) pour guitaristes, pensée pour un téléphone posé sur un lutrin. Quatre espaces :

1. **Jouer** : elle écoute au micro, affiche l'accord joué (avec un indice de confiance), son doigté sur guitare, mandoline ou piano, et les prochains accords possibles, de « sûr » à « audacieux ».
2. **Improviser** : un manche interactif (cases 0 à 17) avec les gammes pentatoniques, blues, majeure, mineure naturelle et mixolydienne, les 5 positions pentatoniques, les noms de notes ou les intervalles, et un mode débutant. Toucher une note la fait entendre.
3. **Accompagner** : des boucles d'accords avec batterie, en blues, rock, folk ou country, avec décompte, lecture/pause/arrêt et volumes séparés. Le métronome complet (TAP tempo, signatures, entraînement) se trouve aussi ici.
4. **Comprendre** : un cercle des quintes interactif, les accords de la tonalité et leur fonction, des progressions par style, et l'analyse d'une progression (tonalité avec son degré de certitude, rôle des accords, gammes pour improviser).

La tonalité, le tempo et les accords joués sont partagés entre les quatre espaces.

Tout tourne dans le téléphone : **le son ne quitte jamais l'appareil**, aucune donnée n'est envoyée, aucun compte.

Interface en français, anglais et espagnol ; notation C D E… ou Do Ré Mi… réglable séparément.

## Utiliser l'app

Ouvrez l'adresse publique dans **Chrome sur Android**, puis menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »). Une fois installée, elle fonctionne hors ligne.

Le micro exige une connexion **HTTPS** : c'est une règle des navigateurs.

## Installation pour développer

Prérequis : Node.js 22 ou plus récent.

```bash
npm ci --ignore-scripts
npm run dev        # serveur local sur http://localhost:5173
npm test           # tests unitaires (Vitest)
npm run build      # version de production dans dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

`--ignore-scripts` empêche toute dépendance d'exécuter du code à l'installation (voir [DEPENDENCIES.md](DEPENDENCIES.md)).

Sans guitare : Réglages → **Mode débogage**, puis « Envoyer le signal de test » dans l'onglet Accords. Le signal passe par la même chaîne d'analyse que le micro.

## Architecture

```
src/
  theory/       moteur harmonique PUR : notes, accords, tonalités (Krumhansl), chiffres romains, Camelot
  theory/       (suite) gammes, positions sur le manche, fonctions harmoniques, analyse prudente, progressions
  suggestions/  graphe des relations (diatoniques, relatif, quintes, V/x, emprunts, médiantes) + classement
  instruments/  modèle commun « cordes accordées + cases », doigtés guitare/mandoline, renversements piano
  metronome/    planificateur (horloge injectée), TAP tempo, entraînement, sons Web Audio, préréglages
  accompaniment/ motifs rythmiques originaux, arrangeur (pur) calé sur le métronome, orchestre synthétisé
  detection/    FFT → chromagramme → gabarits d'accords → stabilisation ; évitement des clics ; seuil de bruit adaptatif
  audio/        AudioContext unique, capture micro (AudioWorklet), tampon circulaire, signal de test
  render/       diagrammes SVG (accords, manche interactif, clavier, cercle des quintes), cercles du métronome
  synth/        petit synthé pour écouter un accord
  i18n/         fr.json, en.json, es.json, notation des notes
  ui/           vues, réglages, Wake Lock
  data/         doigtés de référence (JSON)
tests/          un fichier de tests par module + tests d'architecture
docs/adr/       décisions d'architecture
```

Le flux, en une phrase : le micro remplit un tampon horodaté sur l'horloge audio ; toutes les 50 ms, le détecteur choisit une fenêtre sans clic de métronome, en tire 12 « énergies de notes », les compare aux accords connus, attend que le résultat soit stable ~350 ms, puis l'interface affiche l'accord, son doigté et les suggestions calculées par `theory/` + `suggestions/`.

`theory/` et `metronome/` ne dépendent ni de l'interface ni du micro (vérifié par `tests/architecture.test.ts`) : ils sont prêts à être réutilisés par la future version DJ (BEATBOCK).

## Déploiement

Chaque `push` sur `main` lance `.github/workflows/ci.yml` :

1. `npm ci --ignore-scripts`
2. `npm audit --audit-level=high` (échec si vulnérabilité haute ou critique)
3. vérification des types, tests, build
4. OSV-Scanner sur `package-lock.json`
5. publication de `dist/` sur **GitHub Pages**

CodeQL (`codeql.yml`) et Dependabot (`.github/dependabot.yml`) surveillent le code et les dépendances.

Pour un autre hébergeur (ex. un sous-domaine Hostinger) : `npm run build`, puis copier le contenu de `dist/` dans un dossier **neuf**. Les chemins sont relatifs, l'app fonctionne dans n'importe quel sous-dossier.

## Sécurité et vie privée

- Aucune dépendance livrée dans l'app ; aucun CDN ; Content-Security-Policy stricte (`default-src 'self'`).
- Seule permission demandée : le micro. Pas de caméra, pas de localisation.
- Réglages et préréglages enregistrés dans le navigateur (localStorage) uniquement.
- Détails et limites de l'audit : [DEPENDENCIES.md](DEPENDENCIES.md) (auto-vérification, pas une revue indépendante).

## Limites connues

- **Jamais testé avec une vraie guitare par l'auteur du code** : seulement avec des signaux synthétiques. Voir le [protocole de test réel](docs/TEST-PROTOCOL.md). Un test de code qui passe ne prouve pas qu'un accompagnement ou une gamme « sonne bien » : seule l'écoute le dira.
- Accompagnement sur le haut-parleur : la détection d'accords se met en pause (sinon elle entendrait la boucle). Avec des écouteurs, on peut la garder active.
- L'accompagnement se met en pause quand l'écran s'éteint ou qu'une autre appli passe devant.
- Sons d'accompagnement volontairement simples (synthèse légère, rythmes originaux) ; motifs pensés pour 4 temps.
- Accords reconnus : 12 majeurs + 12 mineurs ; en option 7, maj7, m7, sus2, sus4. Pas de dim, aug, 9, slash chords.
- Csus2 et Gsus4 ont exactement les mêmes notes : seule la basse les distingue, ce qui reste fragile.
- Délai d'affichage d'environ 0,5 s (fenêtre de 170 ms + stabilisation de 350 ms), voulu pour éviter le clignotement.
- Avec le métronome sur le haut-parleur et des subdivisions rapides, moins de trames exploitables : écouteurs filaires recommandés.
- GitHub Pages ne permet pas d'en-têtes HTTP : la CSP passe par une balise `<meta>`, et `Permissions-Policy` n'est pas envoyé.
- En 6/8, 7/8 et 12/8, le BPM compte les croches (un cercle = une croche).
- Si Android met la page en pause (autre appli au premier plan), le métronome se tait au lieu de jouer en rafale ; il reprend sur la grille.

## Licence

Tous droits réservés — voir [LICENSE](LICENSE). Le dépôt est public pour l'hébergement, ce qui n'autorise aucune réutilisation du code.
