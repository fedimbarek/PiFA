# Ce que tu dois préparer ou fournir toi-même

Rien de ce qui suit n'a été inventé ni simulé : ces éléments dépendent de ton compte, de ta machine ou de ton encadrant.

## Obligatoire avant la soutenance

- [ ] **Dépôt GitHub** : pousser ce projet (`git remote set-url origin <ton-dépôt>` puis `git push -u origin main`). Le dépôt d'origine du zip pointe vers `github.com/fedimbarek/PiFA` — vérifie que c'est bien ton dépôt, sinon crée le tien. → **URL du dépôt** à reporter dans la checklist.
- [ ] **GitHub Projects** (exigé par le cahier des charges) : créer un projet « InclusiVenue », importer les lignes de `TASKS.md` comme tickets, une colonne par sprint.
- [ ] **Exécuter les tests sur ta machine** (environnement avec npm) et garder les preuves :
  - `cd backend && npm install && npm run test:unit && npm run test:integration && npm run test:coverage`
  - `cd frontend && npm install && npm run lint && npm test && npm run build`
  - `docker compose up --build -d` puis `cd e2e && npm install && npx playwright install chromium && npx playwright test`
  - Captures/journaux → compléter `TEST-REPORT.md` (sections marquées « non exécuté »).
- [ ] **Vérifier que la CI GitHub Actions passe** (onglet Actions) — capture d'écran du pipeline vert.
- [ ] **Audit accessibilité** : rapport axe (`e2e/test-results/axe-results.json`), **Lighthouse** et **WAVE** sur accueil, liste, fiche, connexion ; un test **NVDA** ou **VoiceOver** du parcours de réservation. Captures dans `deliverables/screenshots/` et résultats dans `ACCESSIBILITY-REPORT.md` §2.
- [ ] **Performance** : Lighthouse (4 catégories) avant/après et `k6 run perf/load-test.k6.js` → compléter `PERFORMANCE-REPORT.md`.
- [ ] **Déploiement** : suivre `DEPLOYMENT.md` (Render + Atlas) → **URL de l'application déployée** et **URL Swagger**.
- [ ] **Captures réelles** de l'application déployée (les captures fournies proviennent du banc de prévisualisation, voir `screenshots/README.md`).
- [ ] **Validation de la fonctionnalité différenciante** par l'encadrant (carte interactive accessible + export iCal + lecture vocale).
- [ ] **Soutenance** : relire et personnaliser `presentation/InclusiVenue-soutenance.pptx` (nom, groupe, encadrant, date, URL), répéter la démo.

## Selon ton encadrant

- [ ] Maquettes Figma (sprint 0) si elles sont exigées.
- [ ] Gabarit de rapport ou page de garde spécifique à ESPRIT.
- [ ] Fichier de contribution Git / pull requests : le cahier des charges parle de « code reviews croisées » ; travaillant seul, explique-le et utilise des branches + PR pour montrer le processus (`git checkout -b feature/x`, PR, merge).

## Identifiants à créer (jamais dans Git)

- `JWT_SECRET` de production
- URI MongoDB Atlas
- Identifiants SMTP (Brevo / Mailjet / Mailtrap) si tu veux de vrais e-mails
- Secret GitHub `RENDER_DEPLOY_HOOK` (facultatif)
