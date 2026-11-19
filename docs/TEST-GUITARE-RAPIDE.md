# Test rapide avec une vraie guitare — 15 minutes

Version courte du [protocole complet](TEST-PROTOCOL.md). Elle couvre les quatre points que les tests automatiques ne peuvent pas prouver : **l'accordeur**, **Pik la mascotte**, **la reconnaissance des notes** et **l'accompagnement**.

Pour chaque point : cochez **OK** ou **PAS OK**. Si c'est PAS OK, écrivez une phrase dans « Ce que j'ai vu ». Pas besoin d'être précis : « l'aiguille saute sur la corde de Ré » suffit.

Version testée : **v3.0.0** (en ligne depuis le 2026-11-19).

## Avant de commencer (2 min)

1. Guitare accordée avec un accordeur de confiance (gardez-le à portée de main pour le test 1).
2. Téléphone Android, Chrome, adresse : `https://bockzilla.github.io/prochain-accord/`
3. Touchez **🎤 Activer le micro** dans l'en-tête et autorisez-le.
4. Posez le téléphone à 50 cm de la guitare, dans une pièce calme.
5. Gardez des **écouteurs filaires** sous la main (test 4).

## Test 1 — Accordeur (3 min)

**Jouer → Accordeur**, mode **Guitare (standard)**.

| # | Faites | Attendu | OK / PAS OK |
|---|---|---|---|
| 1.1 | Jouez les 6 cordes à vide, une par une, en laissant sonner | La bonne corde s'allume, l'aiguille se pose sans trembler, « Juste ✓ » en vert | |
| 1.2 | Détendez un peu la corde de La, rejouez-la | « Trop bas ↑ resserrez », aiguille à gauche | |
| 1.3 | Resserrez jusqu'au vert, puis vérifiez avec votre accordeur de confiance | Les deux disent « juste » (écart à noter en cents si votre accordeur l'affiche) | |
| 1.4 | Grattez un accord complet | L'aiguille ne saute pas ; « Signal instable… » est normal | |

## Test 2 — Pik et le monde (3 min)

**Jouer → Monde.** Dans la barre du bas, touchez **Démarrer** (métronome à 100 BPM par défaut).

| # | Faites | Attendu | OK / PAS OK |
|---|---|---|---|
| 2.1 | Regardez Pik pendant 4 mesures | Il saute **à chaque clic** (il touche le sol sur le clic, pas avant ni après) ; plus haut juste avant le temps 1 ; le numéro du temps s'affiche au-dessus de sa tête | |
| 2.2 | Touchez un îlot voisin | Pik y saute au temps suivant ; l'explication du chemin s'affiche | |
| 2.3 | Arrêtez le métronome, attendez 10 s | Pik respire et cligne des yeux (il ne reste pas figé) | |
| 2.4 | Ressenti : est-ce agréable à regarder en jouant ? | Note de 1 à 5 | |

Si Pik semble **en retard** sur le clic avec des écouteurs Bluetooth : c'est le décalage Bluetooth, réglable dans Réglages → **Décalage de latence**. Notez-le, mais faites le test avec le haut-parleur ou des écouteurs filaires.

## Test 3 — Reconnaissance (4 min)

### 3a. Accords — Jouer → Monde

| # | Faites | Attendu | OK / PAS OK |
|---|---|---|---|
| 3.1 | Grattez lentement **C, G, Am, F, D, Em** (4 fois chacun) | Le bon nom en moins d'une seconde, sans clignoter vers un autre accord. Notez combien sont justes sur 6 | |
| 3.2 | Pendant ce temps | Le monde suit : Pik se déplace vers l'îlot de l'accord joué | |

### 3b. Notes — Improviser

Choisissez **La mineur**, pentatonique mineure, position 1 (cases 5 à 8).

| # | Faites | Attendu | OK / PAS OK |
|---|---|---|---|
| 3.3 | Jouez une note à la fois : La (corde de Mi grave, case 5), puis Do (case 8) | La note s'allume sur le manche avec toutes ses positions possibles (l'app ne devine pas la corde : c'est normal) | |
| 3.4 | Jouez un La♯ (corde de Mi grave, case 6) | Message « hors gamme : à utiliser en passage » | |
| 3.5 | Jouez vite 4 notes de suite | L'app suit, ou dites à partir de quelle vitesse elle décroche | |

## Test 4 — Accompagnement (3 min)

**Branchez les écouteurs filaires.** Accompagner → **Sortie du son : Casque / écouteurs** → style **Blues**, tonalité **La**, 90 BPM → **Lecture**.

| # | Faites | Attendu | OK / PAS OK |
|---|---|---|---|
| 4.1 | Écoutez 2 tours de grille | Décompte, puis batterie et accords bien en place ; l'accord affiché change au bon moment | |
| 4.2 | Ouvrez **Improviser** pendant la lecture | Les notes de l'accord en cours sont cerclées et changent avec la grille | |
| 4.3 | Jouez des accords à la guitare par-dessus | Votre accord est reconnu, pas celui de la boucle | |
| 4.4 | Changez de style (Rock, Folk, Country) | Le monde, le costume de Pik et les couleurs changent, **le son ne coupe pas** | |
| 4.5 | Enlevez les écouteurs, Sortie du son : **Haut-parleur du téléphone** | Un avertissement s'affiche ; un accord identique à la boucle est marqué « ≈ probablement l'accompagnement » | |
| 4.6 | Ressenti musical : ça donne envie de jouer ? | Note de 1 à 5 | |

## Résultats à m'envoyer

Copiez ce bloc dans la conversation, remplissez-le :

```
Appareil : (ex. Pixel 7, Chrome 142) — Micro : téléphone / interface (laquelle)
1 Accordeur   : 1.1 __ 1.2 __ 1.3 __ (écart : __ cents) 1.4 __
2 Pik         : 2.1 __ 2.2 __ 2.3 __ ressenti __/5
3 Reconnaissance : accords justes __/6, 3.2 __ 3.3 __ 3.4 __ 3.5 __
4 Accompagnement : 4.1 __ 4.2 __ 4.3 __ 4.4 __ 4.5 __ ressenti __/5
Ce que j'ai vu :
-
```

## Fiche problème (un problème = une fiche)

Si quelque chose ne va pas, ces cinq lignes suffisent pour que je le corrige :

```
Où : (espace et onglet, ex. Jouer → Accordeur)
Ce que j'ai fait : (ex. joué la corde de Ré à vide)
Ce que j'attendais : (ex. D3 juste)
Ce que j'ai vu : (ex. l'aiguille oscille entre −15 et +20)
Ça arrive : toujours / parfois / une seule fois
```

Une **vidéo d'écran de 10 secondes** (Android : réglages rapides → Enregistrement d'écran, avec le son) vaut mieux qu'une longue description, surtout pour Pik et la synchronisation.

## Ce qui se passe ensuite

- Chaque PAS OK devient une ligne « Réel : échec » dans la [roadmap](ROADMAP-MUSIC-ADVENTURE.md), puis une correction, testée par un test automatique quand c'est possible.
- Les réglages fins (seuils, profils, sensibilité) ne seront modifiés **qu'à partir de vos mesures**, pas à l'aveugle.
- La version v3.0.0 reste récupérable à tout moment (étiquette Git `v3.0.0`).
