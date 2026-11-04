import { ACCESSIBILITY_FEATURES, ACCESSIBILITY_KEYS } from '../utils/constants.js';

export const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export function createStatsService({ statsRepo, clock = () => new Date() }) {
  async function organizer(userId) {
    const now = clock();
    const [o, perEvent] = await Promise.all([statsRepo.organizerOverview(userId, now), statsRepo.organizerPerEvent(userId)]);
    const capacity = o.capacity || 0;
    const available = o.availableSeats || 0;
    return {
      totalEvents: o.totalEvents || 0,
      publishedEvents: o.published || 0,
      pendingEvents: o.pending || 0,
      draftEvents: o.drafts || 0,
      upcomingEvents: o.upcoming || 0,
      totalReservations: o.reservations || 0,
      seatsBooked: o.seatsBooked || 0,
      cancellations: o.cancellations || 0,
      checkedIn: o.checkedIn || 0,
      totalCapacity: capacity,
      availableSeats: available,
      occupancyRate: rate(capacity - available, capacity),
      attendanceRate: rate(o.checkedIn || 0, o.seatsBooked || 0),
      events: perEvent.map((e) => ({
        ...e,
        id: String(e._id),
        occupancyRate: rate(e.seatsBooked, e.capacity),
        attendanceRate: rate(e.checkedIn, e.seatsBooked),
      })),
    };
  }

  async function admin() {
    const now = clock();
    const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const [o, perCategory, perDay, coverage, top] = await Promise.all([
      statsRepo.adminOverview(now),
      statsRepo.bookingsPerCategory(),
      statsRepo.bookingsPerDay(since),
      statsRepo.accessibilityCoverage(),
      statsRepo.topEvents(5),
    ]);
    const cap = o.events.capacity || 0;
    const avail = o.events.availableSeats || 0;
    return {
      totalUsers: o.users.total || 0,
      totalParticipants: o.users.participants || 0,
      totalOrganizers: o.users.organizers || 0,
      totalAdmins: o.users.admins || 0,
      suspendedUsers: o.users.suspended || 0,
      totalEvents: o.events.total || 0,
      publishedEvents: o.events.published || 0,
      pendingEvents: o.events.pending || 0,
      rejectedEvents: o.events.rejected || 0,
      archivedEvents: o.events.archived || 0,
      upcomingEvents: o.events.upcoming || 0,
      totalReservations: o.bookings.confirmed || 0,
      cancelledReservations: o.bookings.cancelled || 0,
      seatsBooked: o.bookings.seats || 0,
      occupancyRate: rate(cap - avail, cap),
      reservationsByCategory: perCategory.map((r) => ({ category: r._id, reservations: r.reservations, seats: r.seats })),
      reservationsLast30Days: perDay.map((r) => ({ date: r._id, confirmed: r.confirmed, cancelled: r.cancelled })),
      accessibilityCoverage: ACCESSIBILITY_KEYS.map((k) => ({
        key: k,
        label: ACCESSIBILITY_FEATURES[k],
        events: coverage[k] || 0,
        rate: rate(coverage[k] || 0, coverage.total || 0),
      })),
      topEvents: top.map((t) => ({ ...t, id: String(t._id), occupancyRate: rate(t.booked, t.capacity) })),
    };
  }

  return { organizer, admin };
}
