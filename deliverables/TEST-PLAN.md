# Cahier de tests — InclusiVenue

Résultats d'exécution : `../TEST-REPORT.md`.

## 1. Stratégie

| Niveau | Objectif | Outil | Où |
|---|---|---|---|
| Unitaire | Règles métier, permissions, validation, middlewares, utilitaires — sans base | `node:test` + dépôts en mémoire | `backend/tests/unit`, `frontend/src/lib/*.test.js` |
| Intégration | API HTTP réelle + MongoDB réel (en mémoire), bcrypt, JWT, upload | `node:test` + supertest + mongodb-memory-server | `backend/tests/integration` |
| End-to-end | Parcours utilisateur dans un navigateur sur la stack Docker | Playwright | `e2e/tests` |
| Accessibilité | WCAG 2.1 AA automatisé + clavier + zoom + mobile | @axe-core/playwright, Lighthouse, contrôles manuels | `e2e/tests/accessibility.spec.js`, `ACCESSIBILITY-REPORT.md` |
| Performance | Web Vitals, poids, temps de réponse API, charge légère | Lighthouse CI, k6 | `frontend/lighthouserc.json`, `perf/load-test.k6.js` |

Données : seed de démonstration (6 comptes, 7 catégories, 14 événements dont 1 en attente et 1 brouillon, 6 réservations). Les tests d'intégration créent leurs propres données.

## 2. Cas de test fonctionnels

| ID | Exigence | Cas | Attendu | Niveau |
|---|---|---|---|---|
| AUTH-01 | Inscription | Nom, e-mail, mot de passe conforme, CGU | 201, rôle `user`, cookie httpOnly | U, I, E2E |
| AUTH-02 | Pas d'admin à l'inscription | `role: admin` | 400 (validation) / 403 (service) | U, I, E2E |
| AUTH-03 | Entrées invalides | e-mail invalide, mot de passe faible | 400 + message par champ, récapitulatif focalisé | U, I, E2E |
| AUTH-04 | Connexion | bons / mauvais identifiants | 200 / 401 même message | U, I, E2E |
| AUTH-05 | Compte suspendu | connexion ou requête avec ancien jeton | 403 `ACCOUNT_SUSPENDED` | U, I |
| AUTH-06 | Mot de passe oublié | demande, lien, nouveau mot de passe | jeton haché, 1 h, usage unique | U, I |
| AUTH-07 | Injection NoSQL | `{ "email": {"$gt": ""} }` | 400 | U, I |
| AUTH-08 | CSRF | écriture par cookie sans `X-Requested-With` | 403 | U, I |
| RBAC-01 | Routes protégées | sans jeton / mauvais rôle | 401 / 403 | U, I, E2E |
| RBAC-02 | Propriété | organisateur B modifie l'événement de A | 403 | U, I |
| EVT-01 | Création | organisateur, données valides | brouillon, places = capacité | U, I, E2E |
| EVT-02 | Validation | fin < début, capacité 0, prix < 0, champ `status` | 400 | U |
| EVT-03 | Modération | soumettre → approuver / refuser avec motif | published / rejected + notification | U, I, E2E |
| EVT-04 | Visibilité | brouillon consulté par un visiteur | 404 | U, I |
| EVT-05 | Capacité | réduire sous les places réservées | 409 `CAPACITY_BELOW_BOOKED` | U |
| EVT-06 | Archivage | événement futur avec réservations | réservations annulées, places rendues, participants notifiés | U |
| EVT-07 | Suppression | publié / avec réservations | refusée | U |
| EVT-08 | Upload | PNG valide / faux PNG / .exe / autre organisateur | 200 WebP / 400 / 400 / 403 | I |
| SRCH-01 | Recherche | texte, catégorie, ville, dates, gratuit, services, places dispo, tri, pagination | résultats filtrés | U, I, E2E |
| BK-01 | Réservation | participant, événement publié | 201, places décrémentées, notifications | U, I, E2E |
| BK-02 | Doublon | même utilisateur, même événement | 409 `ALREADY_BOOKED` | U, I, E2E |
| BK-03 | Complet | plus de places | 409 `NOT_ENOUGH_SEATS`, « complet » affiché | U, I, E2E |
| BK-04 | Concurrence | 20 (U) / 25 (I) requêtes pour 1 / 3 places | exactement 1 / 3 succès, aucune surréservation | U, I |
| BK-05 | Annulation | par le participant, par un tiers, deux fois, hors délai | ok / 403 / 409 / 400 | U, I, E2E |
| BK-06 | Historique | liste de mes réservations | seulement les miennes | U, I, E2E |
| BK-07 | iCal | export global et par réservation | VCALENDAR valide, confirmées seulement | U, I |
| NOTIF-01 | Notifications | confirmation, annulation, rappel J-1, modération | créées une fois ; e-mail selon préférence ; statut `logged` en dev | U, I, E2E |
| ORG-01 | Tableau de bord | statistiques organisateur | issues des agrégations | U, I |
| ORG-02 | Réservations | liste, pointage, annulation, export CSV | réservé à l'organisateur de l'événement | U, I |
| ADM-01 | Statistiques globales | totaux | égaux aux comptages en base | I |
| ADM-02 | Utilisateurs | filtre, rôle, suspension, suppression, pas sur soi-même | ok / 400 sur soi | U, I |
| ADM-03 | Paramètres et catégories | modifier, créer, supprimer une catégorie utilisée | ok / 409 doublon / 400 utilisée | U, I |
| PREF-01 | Préférences | enregistrer, se reconnecter | valeurs conservées | U, I, E2E |
| DOC-01 | Swagger | toutes les routes documentées | test automatique | U, I |

## 3. Cas d'accessibilité

| ID | Critère WCAG | Vérification |
|---|---|---|
| A11Y-01 | 2.4.1 Contourner des blocs | 1er Tab = lien d'évitement → focus `main` (E2E ✅) |
| A11Y-02 | 2.1.1 / 2.1.2 Clavier, pas de piège | dialogues : focus piégé volontairement, Échap ferme, focus restitué (E2E ✅) |
| A11Y-03 | 2.4.7 Focus visible | contour 3 px bleu / or sur fond sombre (capture 13) |
| A11Y-04 | 1.3.1 / 2.4.6 Titres et landmarks | 1 h1 par page, pas de saut de niveau, header/nav/main/footer (contrôles ✅ 30 pages) |
| A11Y-05 | 1.1.1 Alternatives | toutes les `img` ont `alt` (contrôles ✅) ; alt obligatoire à l'upload |
| A11Y-06 | 3.3.1 / 3.3.2 / 4.1.2 Formulaires | labels associés, aide et erreur via `aria-describedby`, `aria-invalid`, récapitulatif (contrôles + E2E ✅) |
| A11Y-07 | 1.4.3 Contraste | 2 598 nœuds texte mesurés sur 30 pages, 0 sous le seuil (fonds unis ; dégradés exclus du calcul) |
| A11Y-08 | 1.4.4 / 1.4.10 Zoom & reflow | 200 % de texte et largeur 640 px / 390 px sans défilement horizontal (E2E + contrôles ✅) |
| A11Y-09 | 2.3.3 / 2.2.2 Animations | préférence + `prefers-reduced-motion` |
| A11Y-10 | 4.1.3 Messages d'état | toasts dans `role=status` / `role=alert`, compteurs de résultats `aria-live` |
| A11Y-11 | Automatisé | axe-core sur 18 pages (⏳), Lighthouse ≥ 90 (⏳), WAVE (manuel, ⏳) |
| A11Y-12 | Lecteurs d'écran | NVDA + Firefox, VoiceOver + Safari : parcours réservation (manuel, ⏳) |

## 4. Critères de sortie

- 0 échec unitaire et d'intégration ; couverture lignes backend ≥ 80 %.
- 0 violation axe « serious » ou « critical ».
- Lighthouse ≥ 80 sur les 4 catégories (≥ 90 en accessibilité).
- k6 : taux d'erreur < 1 %, p95 listes < 400 ms.
