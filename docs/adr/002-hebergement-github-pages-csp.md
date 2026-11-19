# ADR 002 — Hébergement GitHub Pages, CSP par `<meta>`

**Statut :** accepté — 2026-11-18

**Contexte.** Le micro (`getUserMedia`) exige HTTPS. GitHub Pages est gratuit en HTTPS, mais demande un dépôt public sur un compte gratuit, et ne permet **pas** de définir des en-têtes HTTP.

**Décision.** Dépôt public `Bockzilla/prochain-accord` (choix du propriétaire), licence « tous droits réservés ». Déploiement par GitHub Actions. La Content-Security-Policy est injectée au build dans une balise `<meta http-equiv>` : `default-src 'self'`, aucun script ou style externe, `object-src 'none'`, `form-action 'none'`.

**Conséquences.** + Gratuit, HTTPS automatique, rien à administrer. − Le code est lisible publiquement (protégé seulement par la licence). − Impossible d'envoyer `Permissions-Policy`, `frame-ancestors` ou HSTS personnalisé : la protection « seul le micro » repose sur le fait que l'app n'appelle que `getUserMedia({ audio: true, video: false })`. Si ces en-têtes deviennent nécessaires : Cloudflare Pages ou Hostinger (fichier `_headers` / `.htaccess`).
