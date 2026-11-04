export const ROLES = Object.freeze({ USER: 'user', ORGANIZER: 'organizer', ADMIN: 'admin' });
/** Roles a person may pick when registering. Administrators are only created by seed or by another admin. */
export const SELF_REGISTER_ROLES = [ROLES.USER, ROLES.ORGANIZER];

export const EVENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
});

export const BOOKING_STATUS = Object.freeze({ CONFIRMED: 'confirmed', CANCELLED: 'cancelled' });

/** Accessibility features an event can offer. Keys are stable API values. */
export const ACCESSIBILITY_FEATURES = Object.freeze({
  wheelchair: 'Accès fauteuil roulant',
  signLanguage: 'Interprétation en langue des signes',
  hearingLoop: 'Boucle magnétique',
  audioDescription: 'Audiodescription',
  adaptedTransport: 'Transport adapté',
  accessibleToilets: 'Sanitaires accessibles',
  subtitles: 'Sous-titrage / vélotypie',
  easyRead: 'Documents en FALC (facile à lire)',
  braille: 'Documents en braille',
  quietSpace: 'Espace calme',
  assistanceDogs: "Chiens d'assistance acceptés",
  reservedSeating: 'Places réservées PMR',
});
export const ACCESSIBILITY_KEYS = Object.keys(ACCESSIBILITY_FEATURES);

export const NOTIFICATION_TYPES = [
  'booking_confirmed',
  'booking_cancelled',
  'event_reminder',
  'event_submitted',
  'event_approved',
  'event_rejected',
  'event_archived',
  'event_cancelled',
  'new_booking',
  'contact_message',
  'system',
];

export const MAX_SEATS_PER_BOOKING_DEFAULT = 4;
/** Cancellation is allowed until this many hours before the event starts. */
export const CANCELLATION_DEADLINE_HOURS_DEFAULT = 2;
