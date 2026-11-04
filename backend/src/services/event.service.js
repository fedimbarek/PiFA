import { ACCESSIBILITY_KEYS, EVENT_STATUS, BOOKING_STATUS } from '../utils/constants.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { pageResult } from '../utils/pagination.js';
import * as perm from '../utils/permissions.js';

/** Build the MongoDB filter for the public search. Pure → unit tested. */
export function buildEventFilter(q, now = new Date()) {
  const filter = { status: EVENT_STATUS.PUBLISHED };
  if (q.includePast !== 'true') filter.endDate = { $gte: now };
  if (q.q) filter.$text = { $search: q.q };
  if (q.categoryId) filter.category = q.categoryId;
  if (q.city) filter['venue.city'] = new RegExp(`^${q.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (q.from || q.to) {
    filter.startDate = {};
    if (q.from) filter.startDate.$gte = q.from;
    if (q.to) {
      const end = new Date(q.to);
      end.setUTCHours(23, 59, 59, 999);
      filter.startDate.$lte = end;
    }
  }
  if (q.free === 'true') filter.isFree = true;
  if (q.free === 'false') filter.isFree = false;
  for (const f of q.features || []) filter[`accessibility.${f}`] = true;
  if (q.available === 'true') filter.availableSeats = { $gt: 0 };
  return filter;
}

export function buildEventSort(sort, hasText) {
  switch (sort) {
    case '-date':
      return { startDate: -1 };
    case 'price':
      return { price: 1, startDate: 1 };
    case '-price':
      return { price: -1, startDate: 1 };
    case 'recent':
      return { publishedAt: -1, createdAt: -1 };
    case 'relevance':
      return hasText ? { score: { $meta: 'textScore' }, startDate: 1 } : { startDate: 1 };
    default:
      return { startDate: 1 };
  }
}

/** Convert API input (lat/lng) into the stored GeoJSON shape. */
export function toEventDocument(input) {
  const doc = { ...input };
  if (input.venue) {
    const { latitude, longitude, ...venue } = input.venue;
    doc.venue = { ...venue };
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      doc.venue.location = { type: 'Point', coordinates: [longitude, latitude] };
    } else {
      doc.venue.location = undefined;
    }
  }
  if (input.accessibility) {
    doc.accessibility = Object.fromEntries(ACCESSIBILITY_KEYS.map((k) => [k, Boolean(input.accessibility[k])]));
  }
  if ('price' in input) doc.isFree = !input.price;
  if ('coverAlt' in input) {
    doc['coverImage.alt'] = input.coverAlt;
    delete doc.coverAlt;
  }
  return doc;
}

/** Client-facing event representation. */
export function serializeEvent(e) {
  if (!e) return e;
  const coords = e.venue?.location?.coordinates;
  const booked = (e.capacity ?? 0) - (e.availableSeats ?? 0);
  const { location: _location, ...venueRest } = e.venue || {};
  return {
    ...e,
    id: String(e._id),
    venue: {
      ...venueRest,
      latitude: coords?.length === 2 ? coords[1] : null,
      longitude: coords?.length === 2 ? coords[0] : null,
    },
    bookedSeats: booked,
    occupancyRate: e.capacity ? Math.round((booked / e.capacity) * 1000) / 10 : 0,
    accessibilityFeatures: ACCESSIBILITY_KEYS.filter((k) => e.accessibility?.[k]),
  };
}

export function createEventService({
  eventRepo,
  bookingRepo,
  categoryRepo,
  settingsService,
  notificationService,
  clock = () => new Date(),
}) {
  async function loadOr404(id) {
    const e = await eventRepo.findById(id);
    if (!e) throw notFound('Événement introuvable.');
    return e;
  }

  async function assertCategory(categoryId) {
    const c = await categoryRepo.findById(categoryId);
    if (!c || c.active === false) throw badRequest('Catégorie invalide.', { category: 'Catégorie inconnue ou désactivée.' });
    return c;
  }

  async function search(query) {
    const q = { ...query };
    if (q.category) {
      if (/^[a-f\d]{24}$/i.test(q.category)) q.categoryId = q.category;
      else {
        const cats = await categoryRepo.list();
        const match = cats.find((c) => c.slug === q.category);
        if (!match) return pageResult([], 0, { page: q.page, limit: q.limit });
        q.categoryId = match._id;
      }
    }
    const filter = buildEventFilter(q, clock());
    const sortKey = q.sort === 'relevance' && !q.q ? 'date' : q.sort;
    const projection = q.q && sortKey === 'relevance' ? { score: { $meta: 'textScore' } } : undefined;
    const skip = (q.page - 1) * q.limit;
    const { items, total } = await eventRepo.search(filter, { sort: buildEventSort(sortKey, Boolean(q.q)), skip, limit: q.limit, projection });
    return pageResult(items.map(serializeEvent), total, { page: q.page, limit: q.limit });
  }

  async function getById(user, id) {
    const e = await loadOr404(id);
    if (!perm.canViewEvent(user, e)) throw notFound('Événement introuvable.');
    const out = serializeEvent(e);
    if (user) {
      const mine = bookingRepo ? await bookingRepo.findActive(user.id, id) : null;
      out.myBooking = mine ? { id: String(mine._id), seats: mine.seats, reference: mine.reference } : null;
    }
    return out;
  }

  async function create(user, input) {
    if (!perm.canCreateEvent(user)) throw forbidden();
    await assertCategory(input.category);
    const doc = toEventDocument(input);
    const coverAlt = doc['coverImage.alt'];
    delete doc['coverImage.alt'];
    const e = await eventRepo.create({
      ...doc,
      coverImage: { url: '', alt: coverAlt || '' },
      organizer: user.id,
      availableSeats: input.capacity,
      status: EVENT_STATUS.DRAFT,
    });
    return serializeEvent(e);
  }

  async function update(user, id, input) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden('Vous ne pouvez modifier que vos propres événements.');
    if (e.status === EVENT_STATUS.ARCHIVED) throw badRequest('Un événement archivé ne peut plus être modifié.');
    if (input.category) await assertCategory(input.category);
    const start = input.startDate ?? e.startDate;
    const end = input.endDate ?? e.endDate;
    if (new Date(end) <= new Date(start)) throw badRequest('La date de fin doit être après la date de début.', { endDate: 'Date de fin invalide.' });

    const { capacity, ...rest } = input;
    if (capacity !== undefined && capacity !== e.capacity) {
      const updated = await eventRepo.updateCapacity(id, capacity);
      if (!updated) {
        throw conflict(`La capacité ne peut pas être inférieure aux ${e.capacity - e.availableSeats} places déjà réservées.`, 'CAPACITY_BELOW_BOOKED');
      }
    }
    const doc = toEventDocument(rest);
    if (doc.venue) doc.venue = { ...doc.venue }; // full venue replacement
    const saved = await eventRepo.updateById(id, { $set: doc });
    return serializeEvent(saved);
  }

  async function assertManageable(user, id) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden('Vous ne pouvez modifier que vos propres événements.');
    return e;
  }

  async function setCover(user, id, { url, alt }) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden();
    const saved = await eventRepo.updateById(id, { $set: { 'coverImage.url': url, ...(alt !== undefined ? { 'coverImage.alt': alt } : {}) } });
    return serializeEvent(saved);
  }

  async function remove(user, id) {
    const e = await loadOr404(id);
    const confirmed = await bookingRepo.countConfirmed(id);
    if (!perm.canManageEvent(user, e)) throw forbidden();
    if (!perm.canDeleteEvent(user, e, confirmed)) {
      throw badRequest(
        confirmed > 0
          ? 'Cet événement a des réservations confirmées : archivez-le au lieu de le supprimer.'
          : 'Seuls les brouillons, événements en attente ou refusés peuvent être supprimés. Archivez les événements publiés.',
      );
    }
    await eventRepo.deleteById(id);
  }

  async function transition(user, e, to, extra = {}, opts = {}) {
    if (!perm.canTransition(user, e, to, opts)) {
      throw badRequest(`Transition impossible : « ${e.status} » → « ${to} ».`);
    }
    const now = clock();
    const set = { status: to, ...extra };
    if (to === EVENT_STATUS.PUBLISHED) set.publishedAt = now;
    if (to === EVENT_STATUS.ARCHIVED) set.archivedAt = now;
    return eventRepo.updateById(e._id, { $set: set });
  }

  /** Organizer publishes: goes to moderation, or straight to published if moderation is disabled. */
  async function submit(user, id) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden();
    if (new Date(e.startDate) <= clock()) throw badRequest('Impossible de publier un événement dont la date est passée.');
    const settings = await settingsService.get();
    const direct = perm.isAdmin(user) || settings.requireModeration === false;
    const to = direct ? EVENT_STATUS.PUBLISHED : EVENT_STATUS.PENDING;
    const saved = await transition(user, e, to, { 'moderation.submittedAt': clock(), 'moderation.reason': '' }, { selfPublish: direct });
    if (to === EVENT_STATUS.PENDING) {
      await notificationService.notifyAdmins(
        { type: 'event_submitted', title: 'Événement à modérer', message: `« ${e.title} » attend votre validation.`, link: '/admin/moderation' },
        { email: false },
      );
    }
    return serializeEvent(saved);
  }

  async function unsubmit(user, id) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden();
    return serializeEvent(await transition(user, e, EVENT_STATUS.DRAFT));
  }

  async function approve(admin, id) {
    if (!perm.canModerate(admin)) throw forbidden();
    const e = await loadOr404(id);
    const saved = await transition(admin, e, EVENT_STATUS.PUBLISHED, {
      'moderation.moderatedBy': admin.id,
      'moderation.moderatedAt': clock(),
      'moderation.reason': '',
    });
    await notificationService.notify(e.organizer._id ?? e.organizer, {
      type: 'event_approved',
      title: 'Événement publié',
      message: `Votre événement « ${e.title} » a été validé et est maintenant visible publiquement.`,
      link: `/evenements/${id}`,
    });
    return serializeEvent(saved);
  }

  async function reject(admin, id, reason) {
    if (!perm.canModerate(admin)) throw forbidden();
    const e = await loadOr404(id);
    const saved = await transition(admin, e, EVENT_STATUS.REJECTED, {
      'moderation.moderatedBy': admin.id,
      'moderation.moderatedAt': clock(),
      'moderation.reason': reason,
    });
    await notificationService.notify(e.organizer._id ?? e.organizer, {
      type: 'event_rejected',
      title: 'Événement refusé',
      message: `Votre événement « ${e.title} » n'a pas été validé. Motif : ${reason}`,
      link: `/organisateur/evenements/${id}/modifier`,
    });
    return serializeEvent(saved);
  }

  /**
   * Archive. If the event is still in the future, confirmed bookings are cancelled
   * (seats returned) and participants are notified.
   */
  async function archive(user, id) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden();
    const saved = await transition(user, e, EVENT_STATUS.ARCHIVED);
    let cancelled = 0;
    if (new Date(e.startDate) > clock()) {
      const bookings = await bookingRepo.listConfirmedForEvent(id);
      for (const b of bookings) {
        const c = await bookingRepo.cancel(b._id, perm.isAdmin(user) ? 'admin' : 'organizer', clock());
        if (!c) continue;
        cancelled += 1;
        await eventRepo.releaseSeats(id, b.seats);
        await notificationService.notify(b.user, {
          type: 'event_cancelled',
          title: 'Événement annulé',
          message: `L'événement « ${e.title} » a été annulé par l'organisateur. Votre réservation ${b.reference} est annulée.`,
          link: '/mon-espace/reservations',
        });
      }
    }
    if (perm.isAdmin(user) && String(e.organizer._id ?? e.organizer) !== String(user.id)) {
      await notificationService.notify(e.organizer._id ?? e.organizer, {
        type: 'event_archived',
        title: 'Événement archivé',
        message: `Votre événement « ${e.title} » a été archivé par l'administration.`,
        link: '/organisateur/evenements',
      });
    }
    return { ...serializeEvent(saved), cancelledBookings: cancelled };
  }

  async function restoreDraft(admin, id) {
    const e = await loadOr404(id);
    return serializeEvent(await transition(admin, e, EVENT_STATUS.DRAFT));
  }

  async function listForOrganizer(user, { status } = {}) {
    const items = await eventRepo.listByOrganizer(user.id, { status });
    return items.map(serializeEvent);
  }

  async function listForAdmin({ status, q, page, limit }) {
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };
    const sort = status === EVENT_STATUS.PENDING ? { 'moderation.submittedAt': 1 } : { createdAt: -1 };
    const { items, total } = await eventRepo.search(filter, { sort, skip: (page - 1) * limit, limit });
    return pageResult(items.map(serializeEvent), total, { page, limit });
  }

  async function mapPoints() {
    const items = await eventRepo.mapPoints(clock());
    return items.map(serializeEvent);
  }

  async function cities() {
    return (await eventRepo.distinctCities()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  async function reservationsForEvent(user, id) {
    const e = await loadOr404(id);
    if (!perm.canManageEvent(user, e)) throw forbidden('Vous ne pouvez consulter que les réservations de vos événements.');
    const bookings = await bookingRepo.listByEvent(id);
    const confirmed = bookings.filter((b) => b.status === BOOKING_STATUS.CONFIRMED);
    return {
      event: serializeEvent(e),
      bookings,
      summary: {
        reservations: confirmed.length,
        seatsBooked: confirmed.reduce((s, b) => s + b.seats, 0),
        checkedIn: confirmed.filter((b) => b.checkedIn).reduce((s, b) => s + b.seats, 0),
        cancelled: bookings.length - confirmed.length,
      },
    };
  }

  return {
    search,
    getById,
    create,
    update,
    assertManageable,
    setCover,
    remove,
    submit,
    unsubmit,
    approve,
    reject,
    archive,
    restoreDraft,
    listForOrganizer,
    listForAdmin,
    mapPoints,
    cities,
    reservationsForEvent,
  };
}
