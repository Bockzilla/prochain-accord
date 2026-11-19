# ADR 012 — Correctif hors ligne : `ignoreVary`

**Statut :** accepté — 2026-11-19

**Contexte.** En v1, le cache était bien rempli, mais **l'app ne démarrait pas hors ligne**. La requête du script module (attribut `crossorigin`) porte un en-tête `Origin`, absent lors de la mise en cache. Comme `caches.match` respecte l'en-tête `Vary` du serveur, il ne trouvait rien. Je ne l'ai découvert qu'en coupant réellement le serveur.

**Décision.** Le service worker cherche dans le cache avec `{ ignoreSearch: true, ignoreVary: true }`. Les fichiers sont nommés par leur empreinte (hash) : ignorer `Vary` ne risque pas de servir une mauvaise version.

**Conséquences.** Vérifié : serveur arrêté, l'app démarre depuis le cache avec ses 4 espaces. Test à refaire sur le téléphone, en mode avion.
