# Rapport d'audit d'accessibilité — InclusiVenue

**Référentiel visé :** WCAG 2.1 niveau AA (RGAA 4.1 en complément).
**Date :** 4 novembre 2026. **Auditeur :** équipe projet (auto-évaluation — pas d'audit indépendant).
**Statut déclaré :** *partiellement conforme*. La conformité totale n'est **pas** revendiquée : les audits axe, Lighthouse et WAVE et les tests avec lecteurs d'écran restent à exécuter (section 6).

## 1. Périmètre

30 écrans testés (captures dans `screenshots/`) : accueil, liste et filtres, fiche événement, carte, connexion, inscription (et état d'erreur), à propos, contact, déclaration d'accessibilité, 404 ; espace participant (tableau de bord, réservations, notifications, profil, réglages d'accessibilité) ; espace organisateur (tableau de bord, événements, création, réservations, statistiques) ; administration (tableau de bord, modération, utilisateurs, statistiques, paramètres). Viewports : 1280×800, 640×800 (équivalent zoom 200 %), 390×844 (mobile) ; préférences contraste élevé + texte 150 %.

## 2. Tests réalisés et résultats

| # | Test | Méthode | Exécuté | Résultat |
|---|---|---|---|---|
| T1 | Structure : 1 seul `h1`, pas de saut de niveau, landmarks `header/nav/main/footer` | Script Playwright sur le DOM rendu, 30 pages | ✅ | 0 anomalie |
| T2 | Images : attribut `alt` présent | idem | ✅ | 0 anomalie |
| T3 | Champs de formulaire étiquetés (`label for`, `aria-label(ledby)`, label englobant) | idem | ✅ | 0 anomalie |
| T4 | Liens et boutons avec nom accessible | idem | ✅ | 0 anomalie |
| T5 | Identifiants dupliqués | idem | ✅ | 0 anomalie |
| T6 | Contraste texte (4,5:1 ; 3:1 grand texte) calculé sur la couleur et le fond uni réels | idem, 2 598 nœuds texte | ✅ | 0 sous le seuil — *les textes sur dégradé (en-têtes de page, héros) sont exclus du calcul automatique, vérifiés par calcul des couleurs extrêmes : blanc sur #0B1F3A = 16,5:1, sur #1C3F73 = 10,5:1* |
| T7 | Reflow : pas de défilement horizontal à 640 px, 390 px, texte 150 % / 200 % | idem + E2E | ✅ | 0 anomalie après correction (cf. §4) |
| T8 | Lien d'évitement = 1er arrêt de tabulation, mène au contenu | E2E Playwright | ✅ | conforme |
| T9 | Dialogue : focus initial à l'intérieur, piégé (25 Tab), Échap ferme, focus restitué au déclencheur | E2E Playwright | ✅ | conforme |
| T10 | Récapitulatif d'erreurs focalisé après envoi invalide ; `aria-invalid` sur les champs | E2E Playwright | ✅ | conforme après correction |
| T11 | Préférences d'affichage persistées (visiteur : localStorage ; compte : base) | E2E + test d'intégration écrit | ✅ / ⏳ | visiteur conforme ; compte : test d'intégration non exécuté |
| T12 | Parcours complets au clavier/souris (réservation, annulation, création, modération) | E2E Playwright | ✅ | 12/12 parcours réussis |
| T13 | axe-core WCAG 2.0/2.1 A + AA, 18 pages | `e2e/tests/accessibility.spec.js` | ⏳ | **non exécuté** |
| T14 | Lighthouse accessibilité ≥ 90 | `frontend/lighthouserc.json` | ⏳ | **non exécuté** |
| T15 | WAVE (extension navigateur) | manuel | ⏳ | **non exécuté** |
| T16 | NVDA + Firefox / VoiceOver + Safari | manuel | ⏳ | **non exécuté** |
| T17 | ESLint `jsx-a11y` (strict) | `npm run lint` | ⏳ | plugin non installable ici ; configuré pour la CI |

Les tests T1–T12 ont été exécutés sur le **banc de prévisualisation** décrit dans `../TEST-REPORT.md` (vrai frontend, vraie API sur données en mémoire). Les résultats bruts sont dans `tests/ui-checks-report.json`.

## 3. Mise en œuvre par critère

| Critère WCAG 2.1 | Mise en œuvre |
|---|---|
| 1.1.1 Contenu non textuel | `alt` obligatoire à l'upload (formulaire), alt des visuels de démonstration descriptifs ; icônes décoratives `aria-hidden` ; icônes porteuses de sens doublées d'un texte (`sr-only`). |
| 1.2.x Médias temporels | Pas de vidéo/audio publiés. La description d'un événement peut être **lue à voix haute** (synthèse vocale du navigateur). |
| 1.3.1 Information et relations | HTML sémantique (`article`, `nav`, `aside`, `address`, `dl`, `fieldset/legend`, tableaux avec `caption`/`th scope`). Les graphiques sont des tableaux de données dont les barres sont décoratives. |
| 1.3.5 Finalité des champs | `autocomplete` (name, email, tel, organization, current/new-password…). |
| 1.4.1 Couleur | Statuts écrits en toutes lettres (badges), erreurs avec icône + texte. |
| 1.4.3 Contraste | Jetons de couleur vérifiés (tableau §5). Mode contraste élevé noir/blanc. |
| 1.4.4 / 1.4.10 Redimensionnement, reflow | Unités `rem`, grilles fluides `minmax(min(100%,…))`, navigation compacte dès 125 % de texte ou < 960 px ; sélecteur de taille 100–200 %. |
| 1.4.11 Contraste non textuel | Bordures de champs #64748B (4,8:1), contour de focus #1D4ED8 (6,7:1) ou or #E3B341 sur fond marine (8,5:1). |
| 1.4.12 Espacement du texte | Mode « lecture facilitée » (lettres +0,03 em, mots +0,12 em, interligne 1,85). |
| 1.4.13 Contenu au survol | Aucune infobulle ; le menu du compte s'ouvre au clic et se ferme avec Échap. |
| 2.1.1 / 2.1.2 Clavier | Tout est opérable au clavier ; marqueurs de carte focusables (Entrée ouvre la fiche) ; onglets avec flèches gauche/droite ; seul piège volontaire : la boîte de dialogue modale, qui se ferme avec Échap. |
| 2.2.1 Délais | Les notifications restent ≥ 8 s (12 s pour les erreurs), se mettent en pause au survol/focus et sont fermables. |
| 2.3 / 2.3.3 Animations | `prefers-reduced-motion` respecté + préférence « réduire les animations » ; animations de carte désactivées. |
| 2.4.1 Contourner des blocs | Lien « Aller au contenu principal ». |
| 2.4.2 Titre de page | `document.title` unique par route. |
| 2.4.3 Ordre du focus | Ordre DOM = ordre visuel ; à chaque navigation le focus va sur le `h1` de la nouvelle page (annonce par les lecteurs d'écran). |
| 2.4.4 Fonction des liens | Liens de carte nommés par le titre ; boutons d'action répétés complétés en `sr-only` (« Annuler la réservation IV-… »). |
| 2.4.5 Accès multiples | Navigation, recherche, plan du site, fil d'Ariane. |
| 2.4.7 Focus visible | Contour 3 px partout ; la carte entière est encadrée quand son lien a le focus. |
| 2.5.3 / 2.5.5 Cible | Cibles ≥ 44 px (`--touch`). |
| 3.1.1 Langue | `lang="fr"`. |
| 3.2.x Prévisibilité | Les filtres s'appliquent sur bouton explicite ; aucune action au focus. |
| 3.3.1 / 3.3.3 Erreurs | Message par champ (`aria-describedby`, `aria-invalid`), récapitulatif focalisé avec liens vers les champs, messages serveur reportés sur les champs. |
| 3.3.2 Étiquettes | Labels visibles, champs obligatoires signalés (`*` + « obligatoire » vocalisé), aides de saisie. |
| 3.3.4 Prévention des erreurs | Confirmation avant réservation, annulation, archivage, suppression, changement de rôle. |
| 4.1.2 Nom, rôle, valeur | Composants natifs (`button`, `select`, `input`) ; dialogues `role=dialog aria-modal aria-labelledby` ; `aria-expanded` sur menus ; `aria-current` sur la navigation et la pagination. |
| 4.1.3 Messages d'état | Régions `role=status` (polite) et `role=alert` (assertive) permanentes ; nombre de résultats annoncé. |

Fonctions d'adaptation spécifiques : **mode lecteur d'écran** (masque les visuels décoratifs, une colonne), **mode sourd/malentendant** (alertes visuelles renforcées, langue des signes et sous-titrage pré-sélectionnés), **besoins par défaut** pré-cochés dans les filtres et à la réservation.

## 4. Problèmes détectés et corrections appliquées

| Problème | Critère | Correction | Vérifié |
|---|---|---|---|
| Défilement horizontal de l'en-tête avec texte à 150 % sur 1280 px | 1.4.10 | Navigation compacte (menu) dès 125 % de texte ; passage des grilles à une colonne | ✅ T7 |
| Focus envoyé au premier champ invalide au lieu du récapitulatif | 3.3.1 | `shouldFocusError: false` + focus du récapitulatif | ✅ T10 |
| Page Paramètres admin vide (erreur JS) → aucune structure | 1.3.1 | Correction de l'effet React | ✅ T1 |
| Décalage de contenu pendant le chargement des pages (CLS 0,376) gênant pour les utilisateurs de loupe | — (confort) | Hauteur minimale de la zone principale | ✅ CLS 0 |
| Régions live implémentées en `display: contents` (mal exposées par certains navigateurs) | 4.1.3 | Conteneurs réels | revue de code |

## 5. Couleurs (calcul WCAG)

| Texte | Fond | Ratio | Usage |
|---|---|---|---|
| #0F172A | #FFFFFF | 17,9:1 | texte courant |
| #475569 | #FFFFFF | 7,6:1 | texte secondaire |
| #1D4ED8 | #FFFFFF | 6,7:1 | liens, boutons (texte blanc sur #1D4ED8 : 6,7:1) |
| #8A6100 | #FFFFFF | 5,5:1 | sur-titres dorés |
| #166534 | #FFFFFF | 7,1:1 | succès |
| #B91C1C | #FFFFFF | 6,5:1 | erreurs |
| #FFFFFF | #0B1F3A | 16,5:1 | en-tête, pied |
| #E3B341 | #0B1F3A | 8,5:1 | accents sur fond marine |
| #0B1F3A | #E3B341 | 8,5:1 | boutons dorés |

## 6. Limites restantes et actions à mener

1. **Exécuter axe-core** : `cd e2e && npx playwright test tests/accessibility.spec.js` (résultats dans `e2e/test-results/axe-results.json`) et corriger toute violation « serious/critical ».
2. **Exécuter Lighthouse** (DevTools ou `npx @lhci/cli@0.14.0 autorun`) et **WAVE** sur les pages principales ; joindre les captures.
3. **Tests lecteurs d'écran** NVDA (Windows) et VoiceOver (macOS/iOS) : réservation complète, formulaire de création, modération.
4. Les tuiles de carte OpenStreetMap n'ont pas d'alternative textuelle détaillée : la liste des lieux (adresse complète) est toujours affichée sous la carte.
5. Les textes alternatifs des images dépendent des organisateurs (contrôlés lors de la modération).
6. Le mode « lecture facilitée » n'utilise pas de police spécifique dyslexie (OpenDyslexic non embarquée) ; il agit sur les espacements.
7. Les champs date utilisent le sélecteur natif du navigateur, dont l'accessibilité varie selon les navigateurs.
8. Pas de version en langue des signes des contenus du site lui-même.
