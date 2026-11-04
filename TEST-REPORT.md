# Rapport de tests — InclusiVenue

Date d'exécution : 4 novembre 2026. Ce rapport distingue strictement **ce qui a été exécuté** de **ce qui est écrit mais pas encore exécuté**. Aucun résultat n'est inventé.

## Contexte d'exécution

L'environnement de développement utilisé pour produire le projet n'avait **pas accès au registre npm, aux binaires MongoDB ni à Docker**. Conséquences :

- les dépendances déclarées (`express`, `mongoose`, `vite`, `@axe-core/playwright`…) n'ont pas pu être installées ;
- les tests ont été exécutés avec les outils disponibles localement : Node 22 (`node:test`, couverture intégrée), Zod 3.25, Playwright 1.63 + Chromium, esbuild ;
- l'interface a été vérifiée dans un **banc de prévisualisation** : le vrai code frontend (bundlé avec esbuild à partir des sources de React Router 6.28.1, React Hook Form 7.54.2, @hookform/resolvers 3.9.1 et Leaflet 1.9.4 récupérées sur GitHub, React 19.2 au lieu de 18.3) servi avec les **vraies routes, contrôleurs, middlewares, validateurs et services** de l'API, mais avec des dépôts **en mémoire** à la place de MongoDB et un mini-routeur compatible Express. Ce banc n'est pas livré ; il ne remplace pas les tests sur la stack réelle.

## Synthèse

| Suite | Outil | Tests | Exécutés | Résultat |
|---|---|---|---|---|
| Unitaires backend | node:test | 99 | ✅ 99 | **99 réussis, 0 échec** |
| Unitaires frontend (schémas, formatage) | node:test | 6 | ✅ 6 | **6 réussis** |
| Intégration API + MongoDB | node:test + supertest + mongodb-memory-server | 25 | ❌ | Non exécutés (npm et mongod indisponibles) |
| E2E parcours + sécurité | Playwright | 13 | ✅ 13 (banc) | **13 réussis** sur le banc de prévisualisation |
| E2E accessibilité — clavier, dialogue, zoom 200 %, mobile | Playwright | 4 | ✅ 4 (banc) | **4 réussis** sur le banc |
| E2E accessibilité — axe WCAG 2.1 AA | Playwright + @axe-core/playwright | 10 | ❌ | Non exécutés (axe-core non installable) |
| Contrôles UI automatisés (30 pages) | script Playwright maison | 30 pages + 12 parcours | ✅ | **0 anomalie, 12/12 parcours réussis** |
| Lint backend | ESLint 10, règles du cœur | — | ✅ partiel | 0 erreur (sans `@eslint/js` recommended complet) |
| Lint frontend | ESLint 10, règles du cœur | — | ✅ partiel | 0 erreur hors règles de plugins absents (`react-hooks`, `jsx-a11y` non installés) |
| Validation docker-compose | `docker compose config` | — | ✅ | Valide |
| Build et démarrage Docker | Docker | — | ❌ | Non exécuté (pas de démon Docker) |

## 1. Tests unitaires backend — exécutés

Commande : `cd backend && node --test "tests/unit/**/*.test.js"`
Résultat : `tests 99 · suites 22 · pass 99 · fail 0` (≈ 0,6 s).

| Fichier | Ce qui est vérifié |
|---|---|
| `auth.service.test.js` (10) | inscription (hachage, rôle par défaut), **refus du rôle admin**, e-mail en double, inscription organisateur fermée, connexion (message identique e-mail inconnu / mauvais mot de passe), compte suspendu, réinitialisation (jeton haché, usage unique, expiration 1 h, e-mail « logged » et non « sent »), changement de mot de passe |
| `booking.service.test.js` (17) | réservation + décrément + notifications, **doublon refusé**, **5 doubles-clics simultanés → 1 réservation et aucune place perdue**, événement complet, **20 utilisateurs pour la dernière place → exactement 1 succès et 19 refus**, plafond de places, brouillon/passé non réservables, annulation et restitution, double annulation, annulation par un tiers refusée, annulation par l'organisateur/admin, délai d'annulation, historique privé, pointage réservé au propriétaire, export iCal (seulement les confirmées, échappement), rappels envoyés une seule fois |
| `event.service.test.js` (20) | construction des filtres (texte, ville exacte et échappée, dates inclusives, gratuit, services, places dispo), tris, conversion GeoJSON, sérialisation (taux de remplissage), participant ne crée pas, brouillon invisible au public et aux autres organisateurs, modification réservée au propriétaire/admin, **capacité < places réservées refusée**, modération (soumission, publication directe si modération désactivée, approbation/refus avec motif et notification), archivage qui annule les réservations, règles de suppression, réservations visibles par le seul organisateur |
| `permissions.test.js` (8) | matrice des droits par rôle, transitions de statut, auto-publication |
| `validators.test.js` (16) | rôle admin refusé, champs inconnus refusés (mass assignment), politique de mot de passe, dates, capacité, prix, services inconnus, statut non injectable, requête de recherche, bornes de places, préférences |
| `middleware.test.js` (11) | validation → erreurs par champ, suppression des opérateurs `$`, rôles, jeton Bearer/cookie, compte suspendu, jeton antérieur au changement de mot de passe, route publique avec jeton invalide, en-tête CSRF, gestionnaire d'erreurs (pas de fuite de détail) |
| `misc.test.js` (17) | iCal (dates, échappement, pliage 75 octets), pagination, mail (log/smtp/échec), notifications (préférence e-mail, lecture), préférences d'accessibilité (fusion, persistance), administration, catégories, statistiques, **toutes les routes documentées dans OpenAPI** |

Les services sont testés avec des dépôts en mémoire (`tests/helpers/fakes.js`) qui reproduisent les mises à jour conditionnelles atomiques. La concurrence réelle sur MongoDB est couverte par les tests d'intégration (non exécutés).

## 2. Couverture — mesurée

`node --test --experimental-test-coverage` (fichiers : `deliverables/tests/coverage/`)

| Périmètre | Lignes | Branches | Fonctions |
|---|---|---|---|
| 17 fichiers `src/` chargés par les tests unitaires (services, permissions, validateurs, middlewares auth/common, utilitaires, OpenAPI) | **91,6 %** (1779/1943) | **84,2 %** (410/487) | **82,9 %** (136/164) |

Non couverts par les tests unitaires (car liés à Express/Mongoose) : `app.js`, `container.js`, `controllers`, `routes`, `repositories`, `models`, `upload.js`, `config`, `seed`, `jobs`. Ils sont la cible des tests d'intégration ; **la couverture globale du backend n'a donc pas encore été mesurée**. Commande : `npm run test:coverage` (en CI : artefact `backend-coverage`).

## 3. Tests d'intégration — écrits, non exécutés

`backend/tests/integration/` (25 tests) : inscription/connexion/me/déconnexion, refus du rôle admin, injection NoSQL, CSRF par cookie, réinitialisation via la boîte de développement, persistance des préférences entre sessions, suspension immédiate ; cycle de vie complet d'un événement, refus avec motif, recherche/filtres/tri/pagination, upload d'image (WebP, faux fichier refusé, autre organisateur refusé), carte ; réservation/historique/doublon/annulation/iCal, événement complet, **25 requêtes parallèles pour 3 places sur un vrai MongoDB**, double-clic, réservations/pointage/statistiques organisateur, statistiques admin égales aux comptages en base, rappels, gestion des utilisateurs, catégories, paramètres, Swagger, formulaire de contact.

À exécuter : `cd backend && npm install && npm run test:integration` (le premier lancement télécharge un binaire MongoDB, ~70 Mo).

## 4. Tests E2E — exécutés partiellement (banc de prévisualisation)

Commande utilisée : `E2E_BASE_URL=http://localhost:5055 npx playwright test tests/journeys.spec.js tests/security-validation.spec.js` puis `tests/accessibility.spec.js --grep-invert axe`.

| Test | Résultat (banc) |
|---|---|
| 1. Visiteur parcourt les événements et ouvre une fiche | ✅ |
| 2-3. Inscription, déconnexion, reconnexion | ✅ |
| 4-6. Recherche d'un événement avec langue des signes, réservation, historique | ✅ |
| 9. Notification de confirmation reçue | ✅ |
| Doublon de réservation impossible dans l'interface | ✅ |
| Annulation | ✅ |
| 7. Organisateur crée un événement et le soumet | ✅ |
| 8. Administrateur l'approuve, il devient public | ✅ |
| Capacité pleine : 409 côté API, « complet » à l'écran | ✅ |
| Inscription invalide : récapitulatif d'erreurs focalisé, `aria-invalid` | ✅ |
| Mauvais mot de passe : erreur explicite | ✅ |
| Requêtes non autorisées : 401/403, rôle admin refusé à l'inscription | ✅ |
| Participant redirigé hors des pages admin | ✅ |
| Clavier : lien d'évitement en premier, puis focus sur `main` | ✅ |
| Dialogue : focus piégé, Échap, retour du focus | ✅ |
| Texte à 200 % : aucun défilement horizontal (3 pages) | ✅ |
| Mobile (Pixel 7) : bouton menu, pas de défilement horizontal | ✅ |
| axe WCAG 2.1 AA sur 9 pages publiques + 9 pages authentifiées | ⏳ non exécuté |

Pendant ces exécutions, trois défauts **des scripts de test** ont été corrigés (attente de chargement manquante, sélecteur `alert` ambigu à cause de la région de notifications, requête API sans en-tête CSRF — comportement correct de l'API). Résultats bruts : `deliverables/tests/`.

À exécuter sur la vraie stack : `docker compose up --build -d && cd e2e && npm install && npx playwright install chromium && npx playwright test`.

## 5. Défauts trouvés et corrigés grâce aux tests

| Défaut | Détecté par | Correction |
|---|---|---|
| Organisateur : « Enregistrer et publier » échouait quand la modération est désactivée (transition draft→published refusée) | test unitaire | `canTransition(..., { selfPublish })` |
| Page Paramètres admin plantait (`useEffect` renvoyait `null`) | contrôles UI | effet réécrit |
| En-tête qui débordait horizontalement à 150 % de taille de texte | contrôles UI | navigation compacte dès 125 % |
| Décalage de mise en page (CLS 0,376) sur la liste des événements | mesure Web Vitals | hauteur minimale de `main` pendant le chargement des routes |
| Après un envoi invalide, le focus allait au champ et non au récapitulatif | contrôles UI | `shouldFocusError: false` + focus du récapitulatif |
| Variable inutilisée | ESLint | supprimée |

## 6. Plan de test

Voir `deliverables/TEST-PLAN.md`.
