# Captures d'écran

**Origine :** captures produites automatiquement (Playwright, Chromium, 1280×800 sauf mention) du **vrai code frontend** de ce dépôt, connecté aux **vraies routes, contrôleurs, validateurs et services** de l'API, avec des données de démonstration **en mémoire** à la place de MongoDB (banc de prévisualisation, voir `../../TEST-REPORT.md`). Ce ne sont donc pas des captures de l'application déployée : remplace-les ou complète-les par des captures de ta stack Docker / de ton déploiement.

Différences connues avec la stack réelle : React 19 au lieu de 18 pour le rendu ; fonds de carte OpenStreetMap non chargés (pas d'accès réseau) → le message de repli s'affiche ; sélecteurs de date au format du navigateur headless.

| Fichier | Écran |
|---|---|
| 01–11 | Pages publiques (accueil, liste, filtres LSF+fauteuil, fiche, carte, connexion, inscription, à propos, contact, déclaration, 404) |
| 12 | Inscription invalide : récapitulatif d'erreurs |
| 13 | Focus visible sur le lien d'évitement |
| 14–15 | Préférences d'affichage ; accueil en contraste élevé + texte 150 % |
| 16, 16b | Largeur 640 px (équivalent zoom 200 %) |
| 17–18 | Mobile 390 px, menu ouvert |
| 20–26 | Espace participant (tableau de bord, confirmation, réservation confirmée, réservations, notifications, profil, réglages) |
| 30–35 | Espace organisateur (tableau de bord, événements, création, soumission, réservations, statistiques) |
| 40–44 | Administration (tableau de bord, modération, utilisateurs, statistiques, paramètres) |
