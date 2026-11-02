# InclusiVenue

Plateforme de réservation d'événements culturels et associatifs accessibles (Projet Intégré FullstackJS).

## Lancer le projet
**Avec Docker (le plus simple)**
```bash
docker compose up --build
# Site : http://localhost:8080   |  API : http://localhost:4000   |  Swagger : http://localhost:4000/api-docs
```
**En local**
```bash
cd backend  && cp .env.example .env && npm install && npm run dev   # nécessite MongoDB
cd frontend && npm install && npm run dev                          # http://localhost:5173
```
Comptes de démo (mot de passe `Password123`) : `admin@inclusivenue.tn`, `orga@inclusivenue.tn`, `user@inclusivenue.tn`.

## Architecture
```
React (Vite)  ──/api──▶  Express (routes → auth RBAC → modèles Mongoose)  ──▶  MongoDB
```
- Rôles : visiteur / user / organizer / admin (JWT + bcrypt, middleware `auth([...roles])`)
- Réservation : quota **atomique** (`findOneAndUpdate` + `$expr`) → pas de surréservation
- Différenciant : export iCal (`/api/bookings/mine/calendar.ics`)
- Accessibilité : lien d'évitement, landmarks, labels, `aria-live`, focus géré, contraste élevé, taille de texte, police Atkinson Hyperlegible
- DevOps : Docker Compose, GitHub Actions (tests + build + docker)

## Reste à faire (backlog)
- [ ] Migrer le front vers **Next.js** (SSR/SEO) si l'encadrant l'exige
- [ ] Notifications email (nodemailer) + rappels
- [ ] Séparer `routes.js` en controllers/services/repositories
- [ ] Tests d'intégration (supertest + mongodb-memory-server), E2E (Playwright)
- [ ] Rapports : audit accessibilité (axe/WAVE), performance (Lighthouse, k6), schéma d'architecture, soutenance
- [ ] Déploiement (Render/Railway + MongoDB Atlas)

## Commandes utiles
| Commande | Rôle |
|---|---|
| `docker compose up --build` | Lancer tout (site :8080, API :4000) |
| `docker compose down` | Arrêter |
| `docker compose down -v` | Arrêter et vider la base (re-seed au prochain lancement) |
| `cd backend && npm run dev` / `npm test` | API en mode développement / tests |
| `cd frontend && npm run dev` / `npm run build` | Site en développement / build de production |
| `git checkout -b feature/xxx` → `git push -u origin feature/xxx` | Nouvelle branche puis Pull Request |
