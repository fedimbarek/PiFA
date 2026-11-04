import { ACCESSIBILITY_KEYS } from '../utils/constants.js';

/**
 * OpenAPI 3.0 specification served at /api-docs (Swagger UI) and /api-docs.json.
 * Kept next to the routes; tests/unit/openapi.test.js checks every route is documented.
 */
const bearer = [{ bearerAuth: [] }, { cookieAuth: [] }];
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({ 'application/json': { schema, ...(example ? { example } : {}) } });
const ok = (description, schema, example) => ({ description, content: json(schema, example) });
const err = (description) => ({ description, content: json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', example: '665f1c2e9b1e8a3f4c2d1a0b' } };
const R401 = err('Non authentifié');
const R403 = err('Rôle ou propriétaire non autorisé');
const R404 = err('Introuvable');
const R400 = err('Données invalides (détail par champ dans error.fields)');

const op = (tag, summary, { auth = false, roles, body, bodyExample, params = [], query = [], responses = {}, description } = {}) => ({
  tags: [tag],
  summary,
  ...(description || roles ? { description: [description, roles ? `Rôles autorisés : ${roles}.` : ''].filter(Boolean).join(' ') } : {}),
  ...(auth ? { security: bearer } : {}),
  ...(params.length || query.length ? { parameters: [...params, ...query] } : {}),
  ...(body ? { requestBody: { required: true, content: json(body, bodyExample) } } : {}),
  responses: { ...responses, ...(auth ? { 401: R401 } : {}), ...(roles ? { 403: R403 } : {}) },
});

const q = (name, schema, description) => ({ name, in: 'query', required: false, schema, description });

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'InclusiVenue API',
    version: '2.0.0',
    description:
      "API REST de la plateforme InclusiVenue : événements culturels et associatifs accessibles.\n\n" +
      "Authentification : JWT envoyé en `Authorization: Bearer <token>` (clients API, Swagger) ou cookie httpOnly `iv_token` (application web, " +
      "qui doit alors envoyer `X-Requested-With: XMLHttpRequest` sur les requêtes de modification).\n\n" +
      'Erreurs : `{ "error": { "code", "message", "fields?" } }`.',
  },
  servers: [{ url: '/', description: 'Serveur courant' }],
  tags: ['Auth', 'Profil', 'Référentiels', 'Événements', 'Réservations', 'Notifications', 'Organisateur', 'Administration', 'Contact', 'Système'].map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'iv_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, fields: { type: 'object', additionalProperties: { type: 'string' } } } } },
        example: { error: { code: 'BAD_REQUEST', message: 'Certaines informations sont invalides.', fields: { email: 'Adresse e-mail invalide.' } } },
      },
      Preferences: {
        type: 'object',
        properties: {
          fontScale: { type: 'integer', enum: [100, 112, 125, 150, 175, 200] },
          highContrast: { type: 'boolean' },
          reducedMotion: { type: 'boolean' },
          screenReaderMode: { type: 'boolean' },
          dyslexiaFont: { type: 'boolean' },
          underlineLinks: { type: 'boolean' },
          hearingMode: { type: 'boolean' },
          preferredFeatures: { type: 'array', items: { type: 'string', enum: ACCESSIBILITY_KEYS } },
          emailNotifications: { type: 'boolean' },
          otherNeeds: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'organizer', 'admin'] },
          status: { type: 'string', enum: ['active', 'suspended'] },
          organizationName: { type: 'string' },
          preferences: ref('Preferences'),
        },
      },
      AuthResult: { type: 'object', properties: { user: ref('User'), token: { type: 'string' } } },
      Accessibility: { type: 'object', properties: Object.fromEntries(ACCESSIBILITY_KEYS.map((k) => [k, { type: 'boolean' }])) },
      EventInput: {
        type: 'object',
        required: ['title', 'description', 'category', 'startDate', 'endDate', 'venue', 'capacity'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 140 },
          summary: { type: 'string', maxLength: 280 },
          description: { type: 'string', minLength: 20 },
          category: { type: 'string', description: 'ObjectId de catégorie' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          venue: {
            type: 'object',
            required: ['name', 'address', 'city'],
            properties: {
              name: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              latitude: { type: 'number', nullable: true },
              longitude: { type: 'number', nullable: true },
              accessInstructions: { type: 'string' },
            },
          },
          price: { type: 'number', minimum: 0, description: '0 = gratuit (TND)' },
          capacity: { type: 'integer', minimum: 1 },
          accessibility: ref('Accessibility'),
          accessibilityNotes: { type: 'string' },
          coverAlt: { type: 'string', description: "Texte alternatif de l'image de couverture" },
        },
      },
      Event: {
        allOf: [
          ref('EventInput'),
          {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string', enum: ['draft', 'pending', 'published', 'rejected', 'archived'] },
              availableSeats: { type: 'integer' },
              bookedSeats: { type: 'integer' },
              occupancyRate: { type: 'number' },
              isFree: { type: 'boolean' },
              coverImage: { type: 'object', properties: { url: { type: 'string' }, alt: { type: 'string' } } },
              accessibilityFeatures: { type: 'array', items: { type: 'string' } },
              organizer: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, organizationName: { type: 'string' } } },
              category: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } } },
              myBooking: { type: 'object', nullable: true },
            },
          },
        ],
      },
      EventPage: {
        type: 'object',
        properties: { items: { type: 'array', items: ref('Event') }, total: { type: 'integer' }, page: { type: 'integer' }, pages: { type: 'integer' }, limit: { type: 'integer' } },
      },
      Booking: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          reference: { type: 'string', example: 'IV-3FA92C1B' },
          seats: { type: 'integer' },
          status: { type: 'string', enum: ['confirmed', 'cancelled'] },
          event: { oneOf: [{ type: 'string' }, ref('Event')] },
          accessibilityNeeds: { type: 'array', items: { type: 'string' } },
          checkedIn: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          link: { type: 'string' },
          read: { type: 'boolean' },
          emailStatus: { type: 'string', enum: ['none', 'sent', 'logged', 'disabled', 'failed'], description: '"logged" = mode développement, aucun e-mail réel envoyé' },
        },
      },
      Category: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, active: { type: 'boolean' } } },
      Settings: {
        type: 'object',
        properties: {
          requireModeration: { type: 'boolean' },
          maxSeatsPerBooking: { type: 'integer' },
          cancellationDeadlineHours: { type: 'integer' },
          allowOrganizerSignup: { type: 'boolean' },
          maintenanceMessage: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/api/health': { get: op('Système', 'État du service et de la base', { responses: { 200: ok('OK', { type: 'object' }, { status: 'ok', db: 'connected', uptime: 120 }), 503: err('Base indisponible') } }) },

    '/api/auth/register': {
      post: op('Auth', 'Créer un compte participant ou organisateur', {
        description: 'Le rôle administrateur ne peut jamais être choisi à l’inscription (400).',
        body: { type: 'object', required: ['name', 'email', 'password', 'acceptTerms'] },
        bodyExample: { name: 'Amira Ben Salah', email: 'amira@example.tn', password: 'Motdepasse1', role: 'user', acceptTerms: true },
        responses: { 201: ok('Compte créé, cookie de session défini', ref('AuthResult')), 400: R400, 409: err('E-mail déjà utilisé') },
      }),
    },
    '/api/auth/login': {
      post: op('Auth', 'Se connecter', {
        body: { type: 'object', required: ['email', 'password'] },
        bodyExample: { email: 'user@inclusivenue.tn', password: 'Password123' },
        responses: { 200: ok('Connecté', ref('AuthResult')), 401: err('Identifiants incorrects'), 403: err('Compte suspendu'), 429: err('Trop de tentatives') },
      }),
    },
    '/api/auth/logout': { post: op('Auth', 'Se déconnecter (supprime le cookie)', { responses: { 204: { description: 'Déconnecté' } } }) },
    '/api/auth/me': { get: op('Auth', 'Utilisateur courant', { auth: true, responses: { 200: ok('OK', { type: 'object', properties: { user: ref('User') } }) } }) },
    '/api/auth/forgot-password': {
      post: op('Auth', 'Demander un lien de réinitialisation', {
        description: 'Réponse identique que le compte existe ou non. En MAIL_MODE=log, le lien est dans la boîte de développement /api/dev/outbox.',
        body: { type: 'object', required: ['email'] },
        bodyExample: { email: 'user@inclusivenue.tn' },
        responses: { 200: ok('Demande prise en compte', { type: 'object' }) },
      }),
    },
    '/api/auth/reset-password': {
      post: op('Auth', 'Définir un nouveau mot de passe avec le jeton reçu', {
        body: { type: 'object', required: ['token', 'password'] },
        responses: { 200: ok('Mot de passe modifié', { type: 'object' }), 400: err('Jeton invalide ou expiré') },
      }),
    },
    '/api/auth/change-password': {
      post: op('Auth', 'Changer son mot de passe (invalide les sessions existantes)', {
        auth: true,
        body: { type: 'object', required: ['currentPassword', 'newPassword'] },
        responses: { 200: ok('Modifié', { type: 'object' }), 400: R400 },
      }),
    },

    '/api/users/me': {
      get: op('Profil', 'Mon profil', { auth: true, responses: { 200: ok('OK', { type: 'object', properties: { user: ref('User') } }) } }),
      patch: op('Profil', 'Modifier mon profil', {
        auth: true,
        body: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, city: { type: 'string' }, bio: { type: 'string' }, organizationName: { type: 'string' } } },
        responses: { 200: ok('Profil mis à jour', { type: 'object', properties: { user: ref('User') } }), 400: R400 },
      }),
    },
    '/api/users/me/preferences': {
      get: op('Profil', "Mes préférences d'accessibilité", { auth: true, responses: { 200: ok('OK', { type: 'object', properties: { preferences: ref('Preferences') } }) } }),
      put: op('Profil', "Enregistrer mes préférences d'accessibilité (persistées)", {
        auth: true,
        body: ref('Preferences'),
        bodyExample: { fontScale: 125, highContrast: true, reducedMotion: true, preferredFeatures: ['signLanguage'] },
        responses: { 200: ok('Enregistré', { type: 'object', properties: { preferences: ref('Preferences') } }), 400: R400 },
      }),
    },

    '/api/meta/accessibility-features': { get: op('Référentiels', "Liste des services d'accessibilité", { responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/meta/cities': { get: op('Référentiels', 'Villes ayant des événements publiés', { responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/categories': {
      get: op('Référentiels', 'Catégories actives', { responses: { 200: ok('OK', { type: 'object', properties: { categories: { type: 'array', items: ref('Category') } } }) } }),
      post: op('Référentiels', 'Créer une catégorie', { auth: true, roles: 'admin', body: ref('Category'), responses: { 201: ok('Créée', { type: 'object' }), 400: R400, 409: err('Doublon') } }),
    },
    '/api/categories/{id}': {
      patch: op('Référentiels', 'Modifier une catégorie', { auth: true, roles: 'admin', params: [idParam], body: ref('Category'), responses: { 200: ok('OK', { type: 'object' }), 404: R404 } }),
      delete: op('Référentiels', 'Supprimer une catégorie inutilisée', { auth: true, roles: 'admin', params: [idParam], responses: { 204: { description: 'Supprimée' }, 400: err('Catégorie utilisée') } }),
    },

    '/api/events': {
      get: op('Événements', 'Rechercher et filtrer les événements publiés', {
        query: [
          q('q', { type: 'string' }, 'Recherche plein texte (titre, résumé, description, lieu, ville)'),
          q('category', { type: 'string' }, 'Id ou slug de catégorie'),
          q('city', { type: 'string' }),
          q('from', { type: 'string', format: 'date' }),
          q('to', { type: 'string', format: 'date' }),
          q('free', { type: 'string', enum: ['true', 'false'] }),
          q('features', { type: 'string', example: 'wheelchair,signLanguage' }, `Services requis (tous) : ${ACCESSIBILITY_KEYS.join(', ')}`),
          q('available', { type: 'string', enum: ['true', 'false'] }, 'Uniquement avec places disponibles'),
          q('sort', { type: 'string', enum: ['date', '-date', 'price', '-price', 'recent', 'relevance'] }),
          q('page', { type: 'integer', minimum: 1 }),
          q('limit', { type: 'integer', minimum: 1, maximum: 50 }),
        ],
        responses: { 200: ok('Page de résultats', ref('EventPage')), 400: R400 },
      }),
      post: op('Événements', 'Créer un événement (brouillon)', { auth: true, roles: 'organizer, admin', body: ref('EventInput'), responses: { 201: ok('Créé', { type: 'object', properties: { event: ref('Event') } }), 400: R400 } }),
    },
    '/api/events/map': { get: op('Événements', 'Événements géolocalisés pour la carte accessible', { responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/events/{id}': {
      get: op('Événements', "Détail d'un événement", {
        description: 'Public pour les événements publiés ; brouillons visibles par leur organisateur et les administrateurs. Avec authentification, inclut `myBooking`.',
        params: [idParam],
        responses: { 200: ok('OK', { type: 'object', properties: { event: ref('Event') } }), 404: R404 },
      }),
      patch: op('Événements', 'Modifier un événement (propriétaire ou admin)', {
        auth: true,
        roles: 'organizer (propriétaire), admin',
        params: [idParam],
        body: ref('EventInput'),
        responses: { 200: ok('Modifié', { type: 'object' }), 400: R400, 404: R404, 409: err('Capacité inférieure aux places réservées') },
      }),
      delete: op('Événements', 'Supprimer (brouillon/en attente/refusé sans réservation)', { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], responses: { 204: { description: 'Supprimé' }, 400: err('Suppression non permise') } }),
    },
    '/api/events/{id}/submit': { post: op('Événements', 'Soumettre à la modération (ou publier si la modération est désactivée)', { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], responses: { 200: ok('Statut pending ou published', { type: 'object' }), 400: err('Transition impossible') } }) },
    '/api/events/{id}/unsubmit': { post: op('Événements', 'Retirer de la modération (retour brouillon)', { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/events/{id}/archive': { post: op('Événements', 'Archiver (annule et notifie les réservations futures)', { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], responses: { 200: ok('Archivé', { type: 'object' }) } }) },
    '/api/events/{id}/image': {
      post: {
        ...op('Événements', 'Téléverser la couverture (JPEG/PNG/WebP, 2 Mo max, convertie en WebP)', { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], responses: { 200: ok('OK', { type: 'object' }), 400: err('Fichier invalide') } }),
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' }, alt: { type: 'string' } } } } } },
      },
    },
    '/api/events/{id}/reservations': { get: op('Organisateur', "Réservations d'un événement", { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], responses: { 200: ok('OK', { type: 'object' }) } }) },

    '/api/bookings': {
      post: op('Réservations', 'Réserver des places (atomique, sans surréservation)', {
        auth: true,
        body: { type: 'object', required: ['eventId', 'seats'] },
        bodyExample: { eventId: '665f1c2e9b1e8a3f4c2d1a0b', seats: 2, accessibilityNeeds: ['wheelchair'], note: 'Arrivée avec accompagnateur' },
        responses: {
          201: ok('Réservation confirmée', { type: 'object', properties: { booking: ref('Booking') } }),
          400: R400,
          404: err('Événement introuvable ou non publié'),
          409: err('ALREADY_BOOKED ou NOT_ENOUGH_SEATS'),
        },
      }),
    },
    '/api/bookings/me': { get: op('Réservations', 'Historique de mes réservations', { auth: true, query: [q('status', { type: 'string', enum: ['confirmed', 'cancelled'] }), q('page', { type: 'integer' })], responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/bookings/me/calendar.ics': { get: { ...op('Réservations', 'Exporter mes réservations confirmées (iCal)', { auth: true }), responses: { 200: { description: 'Fichier .ics', content: { 'text/calendar': { schema: { type: 'string' } } } }, 401: R401 } } },
    '/api/bookings/{id}': { get: op('Réservations', 'Détail d’une réservation', { auth: true, params: [idParam], responses: { 200: ok('OK', { type: 'object' }), 404: R404 } }) },
    '/api/bookings/{id}/calendar.ics': { get: { ...op('Réservations', 'Exporter une réservation (iCal)', { auth: true, params: [idParam] }), responses: { 200: { description: 'Fichier .ics', content: { 'text/calendar': { schema: { type: 'string' } } } }, 404: R404 } } },
    '/api/bookings/{id}/cancel': { post: op('Réservations', 'Annuler une réservation', { auth: true, params: [idParam], description: 'Participant : jusqu’au délai configuré avant l’événement. Organisateur propriétaire / admin : à tout moment.', responses: { 200: ok('Annulée', { type: 'object' }), 400: err('Délai dépassé'), 403: R403, 409: err('Déjà annulée') } }) },
    '/api/bookings/{id}/check-in': { patch: op('Organisateur', 'Pointer la présence', { auth: true, roles: 'organizer (propriétaire), admin', params: [idParam], body: { type: 'object', properties: { checkedIn: { type: 'boolean' } } }, responses: { 200: ok('OK', { type: 'object' }) } }) },

    '/api/notifications': { get: op('Notifications', 'Mes notifications', { auth: true, query: [q('unread', { type: 'string', enum: ['true', 'false'] }), q('page', { type: 'integer' })], responses: { 200: ok('OK', { type: 'object', properties: { items: { type: 'array', items: ref('Notification') }, unread: { type: 'integer' } } }) } }) },
    '/api/notifications/unread-count': { get: op('Notifications', 'Nombre de notifications non lues', { auth: true, responses: { 200: ok('OK', { type: 'object' }, { unread: 3 }) } }) },
    '/api/notifications/read-all': { post: op('Notifications', 'Tout marquer comme lu', { auth: true, responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/notifications/{id}/read': { patch: op('Notifications', 'Marquer comme lue', { auth: true, params: [idParam], responses: { 200: ok('OK', { type: 'object' }), 404: R404 } }) },
    '/api/notifications/{id}': { delete: op('Notifications', 'Supprimer une notification', { auth: true, params: [idParam], responses: { 204: { description: 'Supprimée' }, 404: R404 } }) },

    '/api/organizer/events': { get: op('Organisateur', 'Mes événements (tous statuts)', { auth: true, roles: 'organizer, admin', query: [q('status', { type: 'string' })], responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/organizer/stats': { get: op('Organisateur', 'Statistiques de fréquentation (calculées en base)', { auth: true, roles: 'organizer, admin', responses: { 200: ok('OK', { type: 'object' }) } }) },

    '/api/admin/stats': { get: op('Administration', 'Statistiques globales', { auth: true, roles: 'admin', responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/admin/users': { get: op('Administration', 'Lister / rechercher les utilisateurs', { auth: true, roles: 'admin', query: [q('q', { type: 'string' }), q('role', { type: 'string' }), q('status', { type: 'string' }), q('page', { type: 'integer' })], responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/admin/users/{id}': {
      patch: op('Administration', 'Changer le rôle ou suspendre/réactiver', { auth: true, roles: 'admin', params: [idParam], body: { type: 'object', properties: { role: { type: 'string' }, status: { type: 'string' } } }, responses: { 200: ok('OK', { type: 'object' }), 400: R400, 404: R404 } }),
      delete: op('Administration', 'Supprimer un utilisateur', { auth: true, roles: 'admin', params: [idParam], responses: { 204: { description: 'Supprimé' }, 404: R404 } }),
    },
    '/api/admin/events': { get: op('Administration', 'Événements par statut (modération)', { auth: true, roles: 'admin', query: [q('status', { type: 'string' }), q('q', { type: 'string' }), q('page', { type: 'integer' })], responses: { 200: ok('OK', ref('EventPage')) } }) },
    '/api/admin/events/{id}/approve': { post: op('Administration', 'Approuver et publier', { auth: true, roles: 'admin', params: [idParam], responses: { 200: ok('Publié', { type: 'object' }), 400: err('Transition impossible') } }) },
    '/api/admin/events/{id}/reject': { post: op('Administration', 'Refuser avec motif', { auth: true, roles: 'admin', params: [idParam], body: { type: 'object', required: ['reason'] }, bodyExample: { reason: "Merci de préciser les conditions d'accès PMR." }, responses: { 200: ok('Refusé', { type: 'object' }), 400: R400 } }) },
    '/api/admin/events/{id}/restore': { post: op('Administration', 'Remettre un événement archivé en brouillon', { auth: true, roles: 'admin', params: [idParam], responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/admin/settings': {
      get: op('Administration', 'Paramètres de la plateforme', { auth: true, roles: 'admin', responses: { 200: ok('OK', { type: 'object', properties: { settings: ref('Settings') } }) } }),
      put: op('Administration', 'Modifier les paramètres', { auth: true, roles: 'admin', body: ref('Settings'), responses: { 200: ok('OK', { type: 'object' }), 400: R400 } }),
    },
    '/api/admin/contact-messages': { get: op('Administration', 'Messages reçus via le formulaire de contact', { auth: true, roles: 'admin', responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/admin/contact-messages/{id}/handled': { patch: op('Administration', 'Marquer un message comme traité', { auth: true, roles: 'admin', params: [idParam], responses: { 200: ok('OK', { type: 'object' }) } }) },
    '/api/admin/reminders/run': { post: op('Administration', 'Lancer manuellement les rappels J-1', { auth: true, roles: 'admin', responses: { 200: ok('OK', { type: 'object' }, { checked: 4, sent: 4 }) } }) },

    '/api/contact': { post: op('Contact', 'Envoyer un message à l’équipe', { body: { type: 'object', required: ['name', 'email', 'subject', 'message'] }, responses: { 201: ok('Transmis', { type: 'object' }), 400: R400 } }) },
    '/api/dev/outbox': { get: op('Système', 'Boîte d’envoi de développement (MAIL_MODE=log, hors production)', { description: 'Les e-mails listés ici n’ont PAS été envoyés.', query: [q('to', { type: 'string' })], responses: { 200: ok('OK', { type: 'object' }) } }) },
  },
};
