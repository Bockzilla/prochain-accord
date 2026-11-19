# Protocole de test réel — environ 20 minutes, avec une vraie guitare

Les tests automatiques utilisent des **signaux synthétiques** : ils ne remplacent pas une vraie guitare, un vrai micro de téléphone et une vraie pièce. Ce protocole sert à le vérifier. Notez les résultats dans le tableau à la fin.

## Préparation (1 min)

1. Accordez la guitare (La = 440 Hz).
2. Ouvrez l'app dans Chrome sur Android, onglet **Jouer**, touchez **Activer le micro** et autorisez-le.
3. Réglages → cochez **Mode débogage** : vous verrez le score de confiance et les barres du chromagramme.
4. Posez le téléphone à environ 50 cm à 1 m de la guitare.

## A. Pièce calme (3 min)

Pour chaque accord **C, G, D, A, E, Am, Em, F, Dm** : grattez 4 fois, lentement.

- [ ] Le bon nom s'affiche ?
- [ ] En moins d'une seconde ?
- [ ] Sans « clignoter » vers un autre accord pendant qu'il sonne ?
- [ ] Le doigté affiché correspond à ce que vous jouez ?

Puis jouez la suite **C – Am – F – G – C** : la tonalité estimée doit devenir **Do majeur (C)**, et les suggestions doivent proposer C, Am, F, Dm, G… en « sûr ». Sans le C final, l'app doit au contraire dire « Do majeur ou La mineur » : c'est voulu, ces accords ont les mêmes notes dans les deux tonalités.

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

## F. Improviser (2 min)

1. Onglet **Improviser**, La mineur, pentatonique mineure, position 1 (cases 5 à 8).
2. Touchez les notes de la corde de Mi grave à la corde de Mi aiguë : on doit entendre une gamme qui monte, sans fausse note.
3. Passez les 5 positions avec ▶ : chacune doit tenir sous la main (environ 4 cases).
4. Affichez les intervalles : sur la position 1, les carrés orange (« 1 ») sont bien sur des La.

## G. Accompagner et improviser (3 min)

1. Mettez des **écouteurs**. Dans **Accompagner** : Blues, « Blues 12 mesures », tonalité La, 90 BPM, Lecture.
2. Le décompte s'entend, puis la batterie et les accords. L'accord affiché change-t-il au bon moment ?
3. Improvisez avec la pentatonique de La (Improviser, position 1) : ça sonne « blues » ?
4. Pause, puis Reprendre : la boucle repart-elle à la mesure où elle s'était arrêtée ?
5. Sans écouteurs, sur le haut-parleur : l'onglet Jouer doit afficher « Détection en pause ».
6. Éteignez l'écran pendant la lecture : l'accompagnement doit se mettre en pause, sans bruit bizarre.

## H. Comprendre (1 min)

Tapez « Am F C G » puis Analyser : l'app doit dire « Ambigu : C majeur ou A mineur ». Tapez « Am Dm E Am » : elle doit dire La mineur (assez sûr).

## I. Hors ligne (30 s)

Ouvrez l'app une fois en ligne, passez en **mode avion**, fermez puis rouvrez l'app : les 4 espaces doivent fonctionner (la toute première ouverture exige Internet).

## Résultats

| Test | Résultat | Remarques |
|---|---|---|
| A — calme (sur 9) | | |
| A — suite C Am F G C → Do majeur ? | | |
| B — bruyant (sur 9), sensibilité utilisée | | |
| C — clic haut-parleur (sur 9) | | |
| C — bip haut-parleur (sur 9) | | |
| C — écouteurs filaires (sur 9) | | |
| D — TAP à 100 BPM | | |
| E — décalage Bluetooth retenu (ms) | | |
| F — positions pentatoniques jouables, sans fausse note | | |
| G — accompagnement synchro, pause/reprise, pause écran éteint | | |
| G — ressenti musical de l'accompagnement (1 à 5) | | |
| H — Am F C G ambigu ; Am Dm E Am = La mineur | | |
| I — fonctionne en mode avion | | |

Envoyez-moi ce tableau : il dira où ajuster (seuils de confiance, sensibilité, fenêtre autour des clics).
