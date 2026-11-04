# Checklist des livrables

| # | Livrable (cahier des charges) | Emplacement | État |
|---|---|---|---|
| 1 | Code source complet | dépôt (`backend/`, `frontend/`, `e2e/`, `perf/`) | ✅ — ⏳ URL du dépôt à fournir |
| 2 | README (installation, architecture, choix) | `../README.md`, `../ARCHITECTURE.md` | ✅ |
| 3 | Cahier de tests + rapport + couverture | `TEST-PLAN.md`, `../TEST-REPORT.md`, `tests/coverage/` | ✅ unitaires / 🟡 intégration, axe et couverture globale à exécuter |
| 4 | Rapport d'audit d'accessibilité (MD + PDF) | `ACCESSIBILITY-REPORT.md`, `pdf/ACCESSIBILITY-REPORT.pdf` | ✅ — 🟡 axe / Lighthouse / WAVE / lecteurs d'écran à exécuter |
| 5 | Rapport de performance avant/après | `PERFORMANCE-REPORT.md`, `performance/`, `pdf/` | ✅ banc — 🟡 Lighthouse et k6 à exécuter |
| 6 | Schéma d'architecture + pipeline DevOps | `diagrams/architecture.svg`, `diagrams/cicd.svg` | ✅ |
| 7 | Documentation API (Swagger) | `/api-docs`, export `api/openapi.json` | ✅ |
| 8 | Support de soutenance PPTX + PDF | `presentation/` | ✅ (à personnaliser) |
| 9 | Démonstration live déployée | — | ⏳ à déployer (`DEPLOYMENT.md`) |
| — | Guide de déploiement | `DEPLOYMENT.md` | ✅ |
| — | Guide utilisateur | `USER-GUIDE.md` | ✅ |
| — | Captures d'écran | `screenshots/` | ✅ banc — ⏳ captures de la stack réelle |
| — | Modèle de données | `DATABASE.md`, `diagrams/database.svg` | ✅ |
| — | Suivi de projet | `../TASKS.md`, `../CHANGELOG.md` | ✅ — ⏳ GitHub Projects |
| — | Rapport final | `../FINAL-REPORT.md` | ✅ |

## Critères d'acceptation

| Critère | État |
|---|---|
| Le frontend se construit | 🟡 bundle esbuild ✅ ; `vite build` à exécuter |
| Le backend démarre / MongoDB se connecte | ⏳ à vérifier (`docker compose up`) |
| Les 4 rôles fonctionnent | ✅ banc (E2E) |
| CRUD événements, recherche/filtres, réservation/annulation, capacité | ✅ unitaires + banc |
| Notifications dans l'environnement configuré | ✅ mode dev (statut « logged » honnête) ; ⏳ SMTP réel |
| Tableaux de bord sur données réelles | ✅ agrégations (banc : données en mémoire) |
| Tests d'accessibilité réalisés | 🟡 contrôles maison + E2E ✅ ; axe/Lighthouse ⏳ |
| Tests automatisés exécutés | ✅ 99 + 6 + 17 ; ⏳ intégration |
| Docker Compose démarre l'application | ⏳ configuration valide, non démarrée ici |
| CI configurée | ✅ (premier passage ⏳) |
| Swagger disponible | ✅ |
| Mesures de performance documentées | ✅ banc ; ⏳ Lighthouse/k6 |
| Aucun défaut critique connu non signalé | ✅ limites listées dans `../FINAL-REPORT.md` §8 |
