# InclusiVenue

**Plateforme de réservation d'événements culturels et associatifs accessibles** — Projet intégré FullstackJS (ESPRIT).

Les associations publient des ateliers, spectacles, conférences et expositions ; les participants, y compris les personnes en situation de handicap visuel, moteur, auditif ou cognitif, les trouvent par **service d'accessibilité** (langue des signes, boucle magnétique, audiodescription, accès fauteuil, transport adapté…), réservent leurs places et signalent leurs besoins.

| | |
|---|---|
| Frontend | React 18 · Vite 5 · React Router 6 · React Hook Form + Zod · CSS Modules + design tokens · Leaflet |
| Backend | Node 22 · Express 4 · architecture en couches (routes → controllers → services → repositories) · Zod |
| Base de données | MongoDB 7 · Mongoose 8 (index texte, géospatial, index unique partiel) |
| Sécurité | JWT (cookie httpOnly SameSite=Strict ou Bearer) · bcrypt · RBAC · helmet · rate limiting · anti-injection NoSQL · en-tête CSRF |
| Documentation API | Swagger UI `/api-docs` · OpenAPI 3 `/api-docs.json` (49 chemins, 58 opérations) |
| DevOps | Docker Compose (mongo + api + web, volumes, health checks) · GitHub Actions (lint, tests, build, E2E, Lighthouse) |
| Différenciant | **Carte interactive accessible** des lieux + **export iCal** + lecture vocale des descriptions |

> ⚠️ État des vérifications : voir [`TEST-REPORT.md`](TEST-REPORT.md) et [`FINAL-REPORT.md`](FINAL-REPORT.md). Les tests unitaires (99) et une partie des tests E2E (17) ont été exécutés ; les tests d'intégration MongoDB, l'audit axe/Lighthouse, k6 et Docker n'ont **pas encore été exécutés** (environnement de développement sans accès npm/Docker) — les commandes sont fournies ci-dessous.

---

## 1. Démarrage rapide (Docker)

Prérequis : Docker Desktop (ou Docker Engine + Compose v2).

```bash
cp .env.example .env            # puis renseignez JWT_SECRET (voir commande dans le fichier)
docker compose up --build -d    # build + démarrage en arrière-plan
docker compose ps               # les 3 services doivent être "healthy"
```

| URL | |
|---|---|
| http://localhost:8080 | Application |
| http://localhost:8080/api-docs | Swagger UI |
| http://localhost:8080/api/health | État API + base |

**Arrêt :** `docker compose down` (les données sont conservées dans le volume `mongo-data`).
`docker compose down -v` **supprime définitivement** la base et les images téléversées — à n'utiliser que volontairement.

Au premier démarrage la base est vide : des données de démonstration sont insérées (`SEED_ON_START=true`).

### Comptes de démonstration (mot de passe `Password123`)

| Rôle | E-mail |
|---|---|
| Administrateur | admin@inclusivenue.tn |
| Organisateur | orga@inclusivenue.tn · orga2@inclusivenue.tn |
| Participant | user@inclusivenue.tn · omar@inclusivenue.tn · nour@inclusivenue.tn |

Ces comptes sont des données de démonstration : changez-les ou désactivez le seed avant toute mise en ligne publique.

## 2. Développement local (sans Docker)

Prérequis : Node.js ≥ 20.11 (22 recommandé), MongoDB 7 local ou Atlas.

```bash
# API
cd backend
cp .env.example .env
npm install
npm run seed          # données de démo (n'écrit rien si la base n'est pas vide)
npm run dev           # http://localhost:4000  —  Swagger : http://localhost:4000/api-docs

# Web (autre terminal)
cd frontend
npm install
npm run dev           # http://localhost:5173  (proxy /api → :4000)
```

En développement `MAIL_MODE=log` : aucun e-mail n'est envoyé ; ils sont listés dans `GET /api/dev/outbox` et affichés dans la console (utile pour le lien de réinitialisation du mot de passe).

## 3. Tests

```bash
cd backend
npm run lint
npm run test:unit          # 99 tests — services, permissions, validation, middleware (sans base)
npm run test:integration   # 25 tests — API réelle + MongoDB en mémoire (télécharge mongod au 1er lancement)
npm run test:coverage      # couverture lcov → backend/coverage/lcov.info

cd ../frontend
npm run lint               # inclut eslint-plugin-jsx-a11y (règles strictes)
npm test                   # tests des schémas et formatages
npm run build

cd ../e2e                  # avec la stack démarrée (docker compose up)
npm install && npx playwright install chromium
npx playwright test        # 27 tests : parcours, sécurité, axe WCAG 2.1 AA, clavier, zoom 200 %, mobile
```

Performance : `k6 run perf/load-test.k6.js` et `cd frontend && npx @lhci/cli@0.14.0 autorun`.

## 4. Architecture

```
inclusivenue/
├─ backend/          API Express (src/{config,models,repositories,services,controllers,routes,middleware,validators,docs,seed,jobs})
├─ frontend/         SPA React (src/{components,context,hooks,lib,pages/{public,user,organizer,admin},styles})
├─ e2e/              Playwright (+ @axe-core/playwright)
├─ perf/             k6
├─ deliverables/     rapports, diagrammes, OpenAPI, captures, soutenance
├─ docker-compose.yml · .github/workflows/
└─ ARCHITECTURE.md · TASKS.md · CHANGELOG.md · TEST-REPORT.md · FINAL-REPORT.md
```

Détails et choix techniques : [`ARCHITECTURE.md`](ARCHITECTURE.md). Schéma : `deliverables/diagrams/architecture.svg`.

**Pourquoi React + Vite et pas Next.js ?** Les pages qui comptent pour le référencement (accueil, liste, fiche événement) sont publiques et légères ; le SEO est traité par des métadonnées, un `robots.txt`, des titres de page par route et des URL lisibles. Le SSR ajouterait un serveur Node supplémentaire sans gain mesurable pour un projet de cette taille. Limite assumée : le contenu des fiches n'est pas pré-rendu côté serveur (voir `FINAL-REPORT.md`, limites).

## 5. Points clés de conception

- **Aucune surréservation** : la place est décrémentée par un unique `findOneAndUpdate` conditionnel (`availableSeats >= n`), opération atomique au niveau document dans MongoDB. Un index unique partiel `(user, event, status=confirmed)` empêche deux réservations actives simultanées du même utilisateur ; en cas de conflit les places sont restituées.
- **Sécurité côté serveur** : chaque route protégée applique `auth.required` + `authorize(rôle)` et les services revérifient la propriété (un organisateur ne modifie que ses événements). Le rôle administrateur ne peut jamais être choisi à l'inscription.
- **Accessibilité** : lien d'évitement, gestion du focus à chaque navigation, formulaires avec récapitulatif d'erreurs, dialogues avec focus piégé, notifications dans des régions `aria-live`, préférences persistées (taille 100–200 %, contraste élevé, animations réduites, lecture facilitée, mode lecteur d'écran, mode sourd/malentendant).
- **Statistiques réelles** : tous les tableaux de bord sont calculés par agrégations MongoDB, rien n'est codé en dur.

## 6. Livrables

Voir [`deliverables/README.md`](deliverables/README.md) et la liste des éléments à fournir par l'étudiant : [`deliverables/A-FOURNIR.md`](deliverables/A-FOURNIR.md).

## Licence et crédits

Police Atkinson Hyperlegible (Braille Institute, SIL Open Font License — `frontend/public/fonts/OFL.txt`). Fonds de carte © contributeurs OpenStreetMap.
