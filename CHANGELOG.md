# Changelog

## [2.0.0] — 2026-11-04
Refonte complète du prototype initial (`bc6dcf9`).

### Ajouté
- API en couches (routes, controllers, services, repositories, middleware), validation Zod, erreurs centralisées, OpenAPI complète (49 chemins, 58 opérations).
- Rôles visiteur / participant / organisateur / administrateur avec contrôle serveur et règles de propriété.
- Cycle de modération (brouillon → en attente → publié / refusé → archivé), paramètres plateforme, catégories.
- Réservation atomique sans surréservation, index anti-doublon, annulation avec délai, pointage, export CSV et iCal.
- Notifications in-app et e-mail (SMTP ou boîte de développement), rappels J-1 idempotents.
- Réinitialisation de mot de passe, changement de mot de passe, suspension de comptes.
- Upload d'images vérifié et converti en WebP.
- Frontend React complet : 29 écrans, design system accessible, préférences persistées, carte Leaflet accessible, lecture vocale.
- Tests : 99 unitaires backend, 6 frontend, 25 d'intégration, 27 E2E Playwright (dont axe).
- Docker Compose avec health checks, nginx, GitHub Actions (CI + images), k6, Lighthouse CI.
- Livrables : rapports de tests, accessibilité, performance, diagrammes, guides, soutenance.

### Corrigé (pendant la vérification)
- Publication directe impossible quand la modération est désactivée.
- Crash de la page Paramètres administrateur.
- Débordement horizontal de l'en-tête avec texte agrandi.
- Décalage de mise en page pendant le chargement des routes (CLS 0,376 → 0).
- Focus après envoi de formulaire invalide.

## [1.0.0] — prototype initial
- Express monolithique, React mono-fichier, export iCal, quota de réservation atomique.
