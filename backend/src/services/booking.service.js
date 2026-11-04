import crypto from 'node:crypto';
import { BOOKING_STATUS, EVENT_STATUS, ACCESSIBILITY_FEATURES } from '../utils/constants.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { paginate, pageResult } from '../utils/pagination.js';
import * as perm from '../utils/permissions.js';
import { buildCalendar } from '../utils/ical.js';

export const makeReference = () => `IV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const formatDate = (d) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date(d));

/** Can this booking still be cancelled by the participant? Pure → unit tested. */
export function cancellationAllowed(event, now, deadlineHours) {
  if (!event) return false;
  const limit = new Date(event.startDate).getTime() - deadlineHours * 3600 * 1000;
  return now.getTime() <= limit;
}

export function createBookingService({ eventRepo, bookingRepo, settingsService, notificationService, clock = () => new Date(), referenceGen = makeReference, appUrl = '' }) {
  /**
   * Book seats.
   * 1. Duplicate check (fast path, friendly message).
   * 2. Atomic conditional decrement on the event document (prevents overbooking).
   * 3. Insert booking; the unique partial index (user,event,status=confirmed) is the
   *    final guard against concurrent duplicates — on violation, seats are released.
   */
  async function create(user, { eventId, seats, accessibilityNeeds = [], note = '' }) {
    if (!perm.canBook(user)) throw forbidden();
    const settings = await settingsService.get();
    const max = settings.maxSeatsPerBooking ?? 4;
    if (seats > max) throw badRequest(`Vous pouvez réserver au maximum ${max} places par réservation.`, { seats: `Maximum ${max}.` });

    const event = await eventRepo.findRawById(eventId);
    if (!event || event.status !== EVENT_STATUS.PUBLISHED) throw notFound('Événement introuvable ou non publié.');
    if (new Date(event.startDate) <= clock()) throw badRequest('Cet événement a déjà commencé : les réservations sont closes.');
    if (await bookingRepo.findActive(user.id, eventId)) {
      throw conflict('Vous avez déjà une réservation confirmée pour cet événement.', 'ALREADY_BOOKED');
    }

    const reserved = await eventRepo.reserveSeats(eventId, seats, clock());
    if (!reserved) {
      const fresh = await eventRepo.findRawById(eventId);
      const left = fresh?.availableSeats ?? 0;
      throw new AppError(
        409,
        'NOT_ENOUGH_SEATS',
        left === 0 ? 'Cet événement est complet.' : `Il ne reste que ${left} place(s) disponible(s).`,
        { availableSeats: left },
      );
    }

    let booking;
    try {
      booking = await bookingRepo.create({
        user: user.id,
        event: eventId,
        seats,
        accessibilityNeeds,
        note,
        unitPrice: event.price || 0,
        reference: referenceGen(),
        status: BOOKING_STATUS.CONFIRMED,
      });
    } catch (err) {
      await eventRepo.releaseSeats(eventId, seats); // compensate the decrement
      if (err?.code === 11000) throw conflict('Vous avez déjà une réservation confirmée pour cet événement.', 'ALREADY_BOOKED');
      throw err;
    }

    const needs = accessibilityNeeds.map((k) => ACCESSIBILITY_FEATURES[k]).filter(Boolean);
    await notificationService.notify(user.id, {
      type: 'booking_confirmed',
      title: 'Réservation confirmée',
      message:
        `Votre réservation ${booking.reference} pour « ${event.title} » (${seats} place(s)) est confirmée. ` +
        `Rendez-vous le ${formatDate(event.startDate)} — ${event.venue.name}, ${event.venue.address}, ${event.venue.city}.` +
        (event.price ? ` Montant à régler sur place : ${(event.price * seats).toFixed(2)} TND.` : ' Entrée gratuite.') +
        (needs.length ? ` Besoins signalés à l'organisateur : ${needs.join(', ')}.` : ''),
      link: '/mon-espace/reservations',
    });
    await notificationService.notify(
      event.organizer,
      {
        type: 'new_booking',
        title: 'Nouvelle réservation',
        message: `${seats} place(s) réservée(s) pour « ${event.title} ». Places restantes : ${reserved.availableSeats}.`,
        link: `/organisateur/evenements/${eventId}/reservations`,
      },
      { email: false },
    );
    return { ...booking, event: { _id: event._id, title: event.title, startDate: event.startDate }, availableSeats: reserved.availableSeats };
  }

  async function cancel(user, bookingId) {
    const booking = await bookingRepo.findRawById(bookingId);
    if (!booking) throw notFound('Réservation introuvable.');
    const event = await eventRepo.findRawById(booking.event);
    const isOwner = String(booking.user) === String(user.id);
    const isManager = event && perm.canManageEvent(user, event);
    if (!isOwner && !isManager) throw forbidden('Vous ne pouvez annuler que vos propres réservations.');
    if (booking.status !== BOOKING_STATUS.CONFIRMED) throw conflict('Cette réservation est déjà annulée.', 'ALREADY_CANCELLED');

    if (isOwner && !isManager) {
      const settings = await settingsService.get();
      const hours = settings.cancellationDeadlineHours ?? 2;
      if (!cancellationAllowed(event, clock(), hours)) {
        throw badRequest(`L'annulation n'est plus possible moins de ${hours} h avant le début de l'événement.`);
      }
    }

    const by = isOwner ? 'user' : perm.isAdmin(user) ? 'admin' : 'organizer';
    const cancelled = await bookingRepo.cancel(bookingId, by, clock());
    if (!cancelled) throw conflict('Cette réservation est déjà annulée.', 'ALREADY_CANCELLED');
    if (event) await eventRepo.releaseSeats(event._id, booking.seats);

    await notificationService.notify(booking.user, {
      type: 'booking_cancelled',
      title: 'Réservation annulée',
      message: `Votre réservation ${booking.reference} pour « ${event?.title ?? 'événement'} » a été annulée${by === 'user' ? '' : " par l'organisateur"}.`,
      link: '/mon-espace/reservations',
    });
    if (event && by === 'user') {
      await notificationService.notify(
        event.organizer,
        { type: 'booking_cancelled', title: 'Annulation', message: `${booking.seats} place(s) libérée(s) pour « ${event.title} ».`, link: `/organisateur/evenements/${event._id}/reservations` },
        { email: false },
      );
    }
    return cancelled;
  }

  async function listMine(user, query = {}) {
    const p = paginate(query, 100);
    const status = Object.values(BOOKING_STATUS).includes(query.status) ? query.status : undefined;
    const { items, total } = await bookingRepo.listByUser(user.id, { status, skip: p.skip, limit: p.limit });
    return pageResult(items, total, p);
  }

  async function getById(user, id) {
    const b = await bookingRepo.findById(id);
    if (!b) throw notFound('Réservation introuvable.');
    if (!perm.canViewBooking(user, b, b.event)) throw notFound('Réservation introuvable.');
    return b;
  }

  async function checkIn(user, bookingId, checkedIn) {
    const b = await bookingRepo.findRawById(bookingId);
    if (!b) throw notFound('Réservation introuvable.');
    const event = await eventRepo.findRawById(b.event);
    if (!event || !perm.canManageEvent(user, event)) throw forbidden();
    const saved = await bookingRepo.setCheckIn(bookingId, checkedIn, clock());
    if (!saved) throw badRequest('Seules les réservations confirmées peuvent être pointées.');
    return saved;
  }

  function toCalendarItem(b) {
    const e = b.event;
    return {
      uid: `${b._id}@inclusivenue`,
      start: e.startDate,
      end: e.endDate,
      title: e.title,
      description: `Réservation ${b.reference} — ${b.seats} place(s). ${e.summary || ''}`.trim(),
      location: [e.venue?.name, e.venue?.address, e.venue?.city].filter(Boolean).join(', '),
      url: `${appUrl}/evenements/${e._id}`,
      status: e.status === EVENT_STATUS.ARCHIVED ? 'CANCELLED' : 'CONFIRMED',
    };
  }

  async function calendarForUser(user) {
    const bookings = (await bookingRepo.listConfirmedByUser(user.id)).filter((b) => b.event);
    return buildCalendar(bookings.map(toCalendarItem), { now: clock() });
  }

  async function calendarForBooking(user, id) {
    const b = await getById(user, id);
    if (b.status !== BOOKING_STATUS.CONFIRMED) throw badRequest('Cette réservation est annulée.');
    return buildCalendar([toCalendarItem(b)], { name: b.event.title, now: clock() });
  }

  /** Create reminder notifications for events starting within `windowHours`. */
  async function sendReminders(windowHours = 24) {
    const now = clock();
    const due = await bookingRepo.findDueReminders(now, new Date(now.getTime() + windowHours * 3600 * 1000));
    let sent = 0;
    for (const b of due) {
      const res = await bookingRepo.markReminderSent(b._id, now);
      if (res?.modifiedCount === 0) continue; // another instance already handled it
      await notificationService.notify(b.user, {
        type: 'event_reminder',
        title: 'Rappel : votre événement approche',
        message: `« ${b.event.title} » commence le ${formatDate(b.event.startDate)} — ${b.event.venue?.name}, ${b.event.venue?.city}. Référence ${b.reference}.`,
        link: `/evenements/${b.event._id}`,
      });
      sent += 1;
    }
    return { checked: due.length, sent };
  }

  return { create, cancel, listMine, getById, checkIn, calendarForUser, calendarForBooking, sendReminders };
}
