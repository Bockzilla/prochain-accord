# Protocole de test réel — 10 minutes, avec une vraie guitare

Les tests automatiques utilisent des **signaux synthétiques** : ils ne remplacent pas une vraie guitare, un vrai micro de téléphone et une vraie pièce. Ce protocole sert à le vérifier. Notez les résultats dans le tableau à la fin.

## Préparation (1 min)

1. Accordez la guitare (La = 440 Hz).
2. Ouvrez l'app dans Chrome sur Android, onglet **Accords**, touchez **Activer le micro** et autorisez-le.
3. Réglages → cochez **Mode débogage** : vous verrez le score de confiance et les barres du chromagramme.
4. Posez le téléphone à environ 50 cm à 1 m de la guitare.

## A. Pièce calme (3 min)

Pour chaque accord **C, G, D, A, E, Am, Em, F, Dm** : grattez 4 fois, lentement.

- [ ] Le bon nom s'affiche ?
- [ ] En moins d'une seconde ?
- [ ] Sans « clignoter » vers un autre accord pendant qu'il sonne ?
- [ ] Le doigté affiché correspond à ce que vous jouez ?

Puis jouez la suite **C – Am – F – G** deux fois : la tonalité estimée doit devenir **Do majeur (C)**, et les suggestions doivent proposer C, Am, F, Dm, G… en « sûr ».

## B. Pièce bruyante (2 min)

Mêmes 9 accords avec un bruit de fond (télé, musique faible, conversation).

- [ ] Combien d'accords justes sur 9 ?
- [ ] Si trop d'erreurs : baissez **Sensibilité du micro** et recommencez. Notez le réglage qui marche.

## C. Avec le métronome (3 min)

1. Onglet Métronome : 90 BPM, 4/4, son **Clic**, puis **Démarrer**. Revenez à l'onglet Accords (la barre compacte reste en bas).
2. Rejouez les 9 accords **par le haut-parleur du téléphone** : notez le nombre de justes sur 9.
3. Changez le son pour **Bip** (le plus « musical », donc le plus piégeux) : rejouez les 9 accords.
4. Avec des **écouteurs filaires** : rejouez les 9 accords.
5. En mode débogage, la ligne « Clic évité : oui » doit apparaître régulièrement : c'est la protection qui travaille.

## D. TAP tempo (1 min)

1. Lancez un métronome de référence externe (autre appli, ou une chanson au tempo connu) à **100 BPM**.
2. Tapez **8 fois** sur TAP en suivant le temps.
- [ ] BPM affiché : ______ (attendu 98 à 102)
3. Attendez 3 secondes, tapez 4 fois à un autre tempo : le calcul doit repartir à zéro.

## E. Synchro image / son (30 s, optionnel)

Avec des écouteurs **Bluetooth** : si le cercle s'allume avant d'entendre le clic, augmentez **Décalage de latence** (Réglages) de 50 ms en 50 ms jusqu'à ce que ça tombe ensemble. Notez la valeur.

## Résultats

| Test | Résultat | Remarques |
|---|---|---|
| A — calme (sur 9) | | |
| A — suite C Am F G → Do majeur ? | | |
| B — bruyant (sur 9), sensibilité utilisée | | |
| C — clic haut-parleur (sur 9) | | |
| C — bip haut-parleur (sur 9) | | |
| C — écouteurs filaires (sur 9) | | |
| D — TAP à 100 BPM | | |
| E — décalage Bluetooth retenu (ms) | | |

Envoyez-moi ce tableau : il dira où ajuster (seuils de confiance, sensibilité, fenêtre autour des clics).
