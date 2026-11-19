# ADR 003 — Capture horodatée et évitement des clics du métronome

**Statut :** accepté — 2026-11-18

**Contexte.** Le clic du métronome entre dans le micro. On connaît l'heure exacte de chaque clic sur l'horloge audio. Il faut que les échantillons du micro soient horodatés sur la **même** horloge.

**Décision.**
- Un seul `AudioContext` pour tout (métronome, synthé, micro). Un AudioWorklet copie les échantillons du micro avec leur numéro de frame (`currentFrame`) dans un tampon circulaire.
- FFT maison de 8192 points (≈ 170 ms à 48 kHz) au lieu de 4096 : 4096 donne ~11,7 Hz par case, trop grossier pour séparer Mi2 (82 Hz) de Fa2 (87 Hz).
- Clics : on **choisit la fenêtre d'analyse la plus récente qui ne contient aucun clic** (fenêtre ignorée : −20 ms / +60 ms autour de l'arrivée estimée au micro = heure du clic + latence de sortie + latence d'entrée), en reculant d'au plus 250 ms. Si les clics sont trop serrés : masquage (mise à zéro avec fondu), et la trame est sautée si plus de 50 % est masquée.
- Les tests ont montré que **mettre à zéro** 35 % d'une fenêtre dégrade plus la détection (14/24) que le clic lui-même ; d'où le choix d'éviter plutôt que de masquer.
- Repli `AnalyserNode` si AudioWorklet indisponible (masquage seulement).
- Traitement du signal désactivé sur le micro (`echoCancellation`, `noiseSuppression`, `autoGainControl` à `false`) : ces filtres sont faits pour la voix et déforment la musique.

**Conséquences.** + Détection fiable avec le métronome (24/24 en test synthétique, aussi avec accords étendus). − Latence d'affichage +0 à 60 ms quand un clic vient de passer. − Avec doubles croches à tempo rapide, moins de trames exploitables : écouteurs filaires recommandés (conseil affiché).
