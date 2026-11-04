import { ROLES, EVENT_STATUS } from './constants.js';

/**
 * Central permission rules. Pure functions so they are unit-testable and
 * reused by services (the API never relies on the UI hiding buttons).
 */
const idOf = (v) => (v && typeof v === 'object' && v._id ? String(v._id) : String(v));

export const isAdmin = (user) => user?.role === ROLES.ADMIN;
export const isOrganizer = (user) => user?.role === ROLES.ORGANIZER;

export function canCreateEvent(user) {
  return isOrganizer(user) || isAdmin(user);
}

export function ownsEvent(user, event) {
  return Boolean(user && event && idOf(event.organizer) === String(user.id));
}

export function canManageEvent(user, event) {
  return isAdmin(user) || (isOrganizer(user) && ownsEvent(user, event));
}

/** Public visibility: published events for everyone; owner and admin see the rest. */
export function canViewEvent(user, event) {
  if (event.status === EVENT_STATUS.PUBLISHED || event.status === EVENT_STATUS.ARCHIVED) return true;
  return canManageEvent(user, event);
}

export function canModerate(user) {
  return isAdmin(user);
}

/** Events with confirmed bookings cannot be deleted, only archived. */
export function canDeleteEvent(user, event, confirmedBookings) {
  if (!canManageEvent(user, event)) return false;
  if (confirmedBookings > 0) return false;
  return isAdmin(user) || [EVENT_STATUS.DRAFT, EVENT_STATUS.REJECTED, EVENT_STATUS.PENDING].includes(event.status);
}

export function canBook(user) {
  // Every authenticated account can book; organizers/admins too (e.g. for an assistant).
  return Boolean(user);
}

export function canViewBooking(user, booking, event) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (idOf(booking.user) === String(user.id)) return true;
  return Boolean(event && ownsEvent(user, event));
}

/** Allowed status transitions per actor. */
const ORGANIZER_TRANSITIONS = {
  [EVENT_STATUS.DRAFT]: [EVENT_STATUS.PENDING, EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.REJECTED]: [EVENT_STATUS.PENDING, EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.PENDING]: [EVENT_STATUS.DRAFT, EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.PUBLISHED]: [EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.ARCHIVED]: [],
};
const ADMIN_TRANSITIONS = {
  [EVENT_STATUS.DRAFT]: [EVENT_STATUS.PENDING, EVENT_STATUS.PUBLISHED, EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.PENDING]: [EVENT_STATUS.PUBLISHED, EVENT_STATUS.REJECTED, EVENT_STATUS.ARCHIVED, EVENT_STATUS.DRAFT],
  [EVENT_STATUS.REJECTED]: [EVENT_STATUS.PUBLISHED, EVENT_STATUS.PENDING, EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.PUBLISHED]: [EVENT_STATUS.ARCHIVED, EVENT_STATUS.REJECTED],
  [EVENT_STATUS.ARCHIVED]: [EVENT_STATUS.DRAFT],
};

/**
 * @param {{selfPublish?: boolean}} [opts] selfPublish: moderation disabled by the
 *   platform settings, so an organizer's submission publishes directly.
 */
export function canTransition(user, event, to, { selfPublish = false } = {}) {
  const table = isAdmin(user) ? ADMIN_TRANSITIONS : ORGANIZER_TRANSITIONS;
  if (!isAdmin(user) && !canManageEvent(user, event)) return false;
  if (selfPublish && to === EVENT_STATUS.PUBLISHED && !isAdmin(user)) {
    return (table[event.status] || []).includes(EVENT_STATUS.PENDING);
  }
  return (table[event.status] || []).includes(to);
}
