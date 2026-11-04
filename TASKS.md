# Suivi des tâches

Légende : ✅ fait et vérifié · 🟡 fait, vérification à compléter · ⏳ à faire par l'étudiant (voir `deliverables/A-FOURNIR.md`).

## Jalon 1 — Architecture, base de données, authentification, interface de base
| Tâche | État | Preuve |
|---|---|---|
| Architecture en couches (routes/controllers/services/repositories/middleware) | ✅ | `ARCHITECTURE.md` |
| Modèles Mongoose + index (texte, 2dsphere, unique partiel) | 🟡 | écrits ; exercés par les tests d'intégration non exécutés |
| Configuration validée par Zod, `.env.example` | ✅ | `config/env.js` |
| Inscription, connexion, déconnexion, profil, mot de passe oublié/changement | ✅ | 10 tests unitaires auth + E2E |
| JWT cookie httpOnly / Bearer, bcrypt, RBAC, admin non auto-attribuable | ✅ | tests unitaires middleware/permissions + E2E sécurité |
| Rate limiting, helmet, anti-injection NoSQL, CSRF, erreurs centralisées | ✅ / 🟡 | sanitize/CSRF/erreurs testés ; rate limiting non testé |
| Design system (tokens, police accessible), layout accessible | ✅ | captures, contrôles UI |

## Jalon 2 — Événements, recherche, réservation, tableaux de bord
| Tâche | État | Preuve |
|---|---|---|
| CRUD événements, publication, archivage, suppression encadrée | ✅ | tests unitaires event + E2E |
| Upload d'images sécurisé (signature, taille, WebP) | 🟡 | test d'intégration écrit, non exécuté |
| Recherche + filtres (texte, catégorie, date, lieu, gratuit, 12 services, dispo) + tri + pagination | ✅ | tests unitaires + E2E |
| Réservation atomique, anti-doublon, capacité, annulation, historique | ✅ / 🟡 | concurrence testée en mémoire ; test MongoDB réel non exécuté |
| Tableau de bord organisateur (stats réelles, réservations, pointage, CSV) | ✅ | E2E/captures |
| Tableau de bord admin (stats, utilisateurs, modération, paramètres, catégories) | ✅ | E2E/captures |

## Jalon 3 — Accessibilité, notifications, fonctionnalités avancées, intégration
| Tâche | État | Preuve |
|---|---|---|
| Préférences d'accessibilité persistées (6 modes + besoins) | ✅ | E2E visiteur ; compte : intégration écrite |
| Notifications in-app + e-mail (SMTP / mode dev honnête) + rappels J-1 | ✅ | tests unitaires notifications/rappels |
| Carte accessible + liste équivalente, export iCal, lecture vocale | ✅ | captures, tests iCal |
| Tests d'intégration API (25) | 🟡 | écrits, ⏳ exécution |
| Contrôles accessibilité automatisés maison + clavier/zoom/mobile | ✅ | 30 pages, 0 anomalie |
| Audit axe / Lighthouse / WAVE / lecteurs d'écran | ⏳ | spec axe prête |

## Jalon 4 — Docker, CI/CD, performance, documentation, livraison
| Tâche | État | Preuve |
|---|---|---|
| Dockerfiles, compose (volumes, health checks), nginx | 🟡 | `docker compose config` valide ; build non exécuté |
| GitHub Actions CI + release images | 🟡 | YAML valide ; ⏳ premier passage |
| Optimisations performance + mesure avant/après (banc) | ✅ | `deliverables/PERFORMANCE-REPORT.md` |
| Lighthouse / k6 sur la stack réelle | ⏳ | commandes fournies |
| Documentation, diagrammes, OpenAPI, guides, soutenance | ✅ | `deliverables/` |
| Déploiement public | ⏳ | `deliverables/DEPLOYMENT.md` |
