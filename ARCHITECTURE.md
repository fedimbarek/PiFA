# Architecture technique — InclusiVenue

Diagrammes : `deliverables/diagrams/architecture.svg`, `cicd.svg`, `database.svg` (sources Mermaid `.mmd` à côté).

## 1. Vue d'ensemble

```
Navigateur ──HTTPS──▶ nginx (web) ──/api, /api-docs, /uploads──▶ Express (api) ──▶ MongoDB
   SPA React           statiques, CSP,                          routes → controllers →
                       cache, gzip                              services → repositories
```

Trois conteneurs (`docker-compose.yml`) : `mongo` (volume `mongo-data`), `api` (volume `uploads`), `web` (nginx). Les trois ont un health check ; `api` attend que `mongo` soit sain, `web` attend `api`.

## 2. Backend (`backend/src`)

| Couche | Fichiers | Rôle |
|---|---|---|
| Configuration | `config/env.js`, `config/db.js` | Variables d'environnement validées par Zod au démarrage (refus de démarrer en production avec un secret JWT faible) ; connexion Mongo + synchronisation des index. |
| Modèles | `models/*.js` | Schémas Mongoose : `User`, `Event`, `Booking`, `Category`, `Notification`, `Setting`, `ContactMessage`, `EmailLog`. Voir `deliverables/DATABASE.md`. |
| Repositories | `repositories/index.js` | Seule couche qui parle à Mongoose : requêtes, opérations atomiques (`reserveSeats`, `releaseSeats`, `updateCapacity`, `cancel`), agrégations statistiques. |
| Services | `services/*.service.js` | Règles métier pures, dépendances injectées (repositories, hasher, tokens, mail, horloge) → testables sans base. |
| Controllers | `controllers/index.js` | Traduction HTTP ↔ services (statuts, cookies, en-têtes iCal). |
| Routes | `routes/index.js` | Table des routes REST, middlewares d'authentification, de rôle et de validation par route. |
| Middleware | `middleware/auth.js`, `common.js`, `upload.js` | JWT (Bearer ou cookie), `authorize(...roles)`, en-tête CSRF, validation Zod → erreurs par champ, nettoyage anti-injection, gestion centralisée des erreurs, upload d'images. |
| Permissions | `utils/permissions.js` | Fonctions pures : propriété d'un événement, transitions de statut autorisées, visibilité, suppression. |
| Documentation | `docs/openapi.js` | Spécification OpenAPI 3 servie par Swagger UI ; un test vérifie que chaque route est documentée. |
| Composition | `container.js`, `app.js`, `server.js` | Assemblage des dépendances, application Express, démarrage + arrêt propre + job de rappels. |

### Flux d'une réservation

1. `POST /api/bookings` → `auth.required` → `validate(createBookingSchema)` → `bookingService.create`.
2. Contrôles : événement publié et non commencé, plafond de places par réservation (paramètre plateforme), pas de réservation active existante.
3. `eventRepository.reserveSeats` : `findOneAndUpdate({_id, status:'published', startDate>now, availableSeats>=n}, {$inc:{availableSeats:-n}})`. Une seule écriture atomique : si deux requêtes visent la dernière place, MongoDB n'en applique qu'une ; l'autre ne trouve plus de document correspondant → 409 `NOT_ENOUGH_SEATS`.
4. Création du `Booking`. L'index unique partiel `uniq_active_booking (user, event) where status='confirmed'` bloque les doublons concurrents ; en cas d'erreur 11000 les places sont restituées (compensation).
5. Notifications in-app (participant + organisateur) et e-mail selon la préférence de l'utilisateur.

Pourquoi pas une transaction multi-documents ? Elle exige un replica set ; l'opération conditionnelle atomique + l'index unique + la compensation garantissent l'invariant *places réservées ≤ capacité* sans cette contrainte d'infrastructure. Le test d'intégration « 25 requêtes parallèles pour 3 places » le vérifie sur un vrai MongoDB.

### Cycle de vie d'un événement

```
draft ──submit──▶ pending ──approve(admin)──▶ published ──archive──▶ archived
  ▲                 │ └──reject(admin, motif)──▶ rejected ──submit──▶ pending
  └──unsubmit───────┘
```
Si l'administrateur désactive la modération (`requireModeration=false`), `submit` publie directement. Archiver un événement futur annule ses réservations, restitue les places et prévient les participants. Suppression possible uniquement sans réservation confirmée (brouillon / en attente / refusé, ou admin).

### Authentification

- Mots de passe : bcrypt (coût 12 ; 4 en test).
- JWT HS256 (`iss=inclusivenue`, 2 h par défaut) déposé dans un cookie `iv_token` httpOnly, `SameSite=Strict`, `Secure` en production. Les clients API (Swagger, k6) peuvent utiliser `Authorization: Bearer`.
- L'utilisateur est rechargé à chaque requête : un compte suspendu, un rôle modifié ou un mot de passe changé prennent effet immédiatement (les jetons antérieurs au changement de mot de passe sont refusés).
- CSRF : les requêtes de modification authentifiées par cookie doivent porter `X-Requested-With: XMLHttpRequest` (impossible depuis un formulaire tiers) ; CORS limité à `CLIENT_URL`.
- Réinitialisation : jeton aléatoire 256 bits envoyé par e-mail, stocké haché (SHA-256), valable 1 h, à usage unique ; réponse identique que le compte existe ou non.
- Limitation de débit : 300 req / 15 min / IP sur l'API, 20 sur les routes d'authentification et de contact.

### Notifications et e-mails

`notificationService.notify()` crée la notification in-app puis, si l'utilisateur l'accepte, envoie l'e-mail :
- `MAIL_MODE=smtp` : envoi via nodemailer et le fournisseur configuré (statut `sent` ou `failed`) ;
- `MAIL_MODE=log` (développement) : l'e-mail est enregistré dans `EmailLog` avec le statut `logged` et affiché dans la console. **Il n'est pas envoyé** et l'interface l'indique (« E-mail non envoyé (mode développement) »).

Rappels J-1 : `jobs/reminders.js` exécute `bookingService.sendReminders(24)` toutes les 15 min ; chaque réservation est marquée atomiquement (`reminderSentAt`) → pas de doublon même avec plusieurs instances.

### Images

Multer (mémoire, 2 Mo, JPEG/PNG/WebP) → vérification de la signature binaire réelle → sharp : rotation EXIF, redimensionnement 1600 px max, ré-encodage WebP q78 (supprime les métadonnées et tout contenu caché) + vignette 640 px. Texte alternatif obligatoire côté formulaire.

## 3. Frontend (`frontend/src`)

| Dossier | Contenu |
|---|---|
| `styles/` | `tokens.css` (couleurs vérifiées ≥ 4,5:1, échelle typographique en rem, espacements, thèmes de préférences), `global.css` (composants : boutons, formulaires, tableaux, alertes…) |
| `components/` | `Layout` (lien d'évitement, en-tête, pied, focus de route, garde de route), `Modal`/`ConfirmDialog`, `ui.jsx` (champs, récapitulatif d'erreurs, états chargement/vide/erreur, pagination, badges), `EventCard`, `charts` (graphiques + tableau équivalent), `MapView`, `Icon` |
| `context/` | `AuthContext` (session par cookie, compteur de notifications), `PreferencesContext` (préférences appliquées sur `<html>` ; compte ou `localStorage`), `ToastContext` (régions live polite/assertive) |
| `pages/` | `public/` (accueil, événements, détail, carte, auth, à propos, contact, déclaration, plan du site, 404), `user/`, `organizer/`, `admin/` |
| `lib/` | client `api.js`, formatage FR (fuseau Africa/Tunis), schémas Zod des formulaires |

- Découpage du code par route (`React.lazy`) : chaque espace est téléchargé seulement s'il est visité ; Leaflet n'est chargé que sur la carte / la fiche.
- Les gardes de route côté client ne sont qu'un confort : toute la sécurité est appliquée par l'API.

## 4. Choix et compromis

| Choix | Raison | Compromis |
|---|---|---|
| JavaScript (JSDoc) plutôt que TypeScript | Le cahier des charges le préfère sans l'imposer ; la validation Zod aux frontières (API + formulaires) couvre les erreurs de forme de données. | Pas de vérification de types statique. |
| SPA Vite plutôt que Next.js | Voir README §4. | Pas de pré-rendu serveur des fiches. |
| CSS Modules + tokens plutôt que Tailwind | Contrôle fin des états de focus, du contraste élevé et des préférences via attributs sur `<html>`. | Plus de CSS écrit à la main. |
| `node:test` plutôt que Jest/Vitest | Intégré à Node 22 (tests + couverture), aucune dépendance. | Moins d'outillage (watch, mocks). |
| Carte Leaflet + OSM | Libre, accessible au clavier, chargée à la demande. | Les tuiles n'ont pas d'alternative textuelle → liste équivalente toujours affichée. |
