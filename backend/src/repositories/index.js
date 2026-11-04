/**
 * Data-access layer. Only this layer talks to Mongoose; services receive these
 * repositories by injection (see src/container.js), which keeps business rules
 * testable with in-memory fakes.
 */
import mongoose from 'mongoose';
import { User, Event, Booking, Category, Notification, Setting, ContactMessage, EmailLog } from '../models/index.js';
import { BOOKING_STATUS, EVENT_STATUS } from '../utils/constants.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));
export const isValidId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(String(id))) === String(id);

const PUBLIC_USER_FIELDS = 'name email role status phone city organizationName bio preferences createdAt lastLoginAt passwordChangedAt';
const EVENT_POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'organizer', select: 'name organizationName email' },
];

export const userRepository = {
  findById: (id) => User.findById(id).select(PUBLIC_USER_FIELDS).lean(),
  findByIdWithPassword: (id) => User.findById(id).select('+passwordHash').lean(),
  findByEmail: (email, { withPassword = false } = {}) =>
    User.findOne({ email: String(email).toLowerCase() })
      .select(withPassword ? `+passwordHash ${PUBLIC_USER_FIELDS}` : PUBLIC_USER_FIELDS)
      .lean(),
  existsByEmail: async (email) => Boolean(await User.exists({ email: String(email).toLowerCase() })),
  create: async (data) => (await User.create(data)).toObject(),
  updateById: (id, update) =>
    User.findByIdAndUpdate(id, update, { new: true, runValidators: true }).select(PUBLIC_USER_FIELDS).lean(),
  deleteById: (id) => User.findByIdAndDelete(id).lean(),
  setResetToken: (id, tokenHash, expiresAt) =>
    User.updateOne({ _id: id }, { $set: { 'passwordReset.tokenHash': tokenHash, 'passwordReset.expiresAt': expiresAt } }),
  findByResetTokenHash: (tokenHash, now) =>
    User.findOne({ 'passwordReset.tokenHash': tokenHash, 'passwordReset.expiresAt': { $gt: now } })
      .select('+passwordReset.tokenHash +passwordReset.expiresAt')
      .lean(),
  setPassword: (id, passwordHash, now) =>
    User.updateOne(
      { _id: id },
      { $set: { passwordHash, passwordChangedAt: now }, $unset: { 'passwordReset.tokenHash': 1, 'passwordReset.expiresAt': 1 } },
    ),
  list: async ({ q, role, status, skip = 0, limit = 20 }) => {
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { organizationName: rx }];
    }
    const [items, total] = await Promise.all([
      User.find(filter).select(PUBLIC_USER_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return { items, total };
  },
  findAdmins: () => User.find({ role: 'admin', status: 'active' }).select('_id email name preferences').lean(),
  countByRole: async () => {
    const rows = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  },
};

export const categoryRepository = {
  list: ({ includeInactive = false } = {}) => Category.find(includeInactive ? {} : { active: true }).sort({ name: 1 }).lean(),
  findById: (id) => Category.findById(id).lean(),
  create: async (data) => (await Category.create(data)).toObject(),
  updateById: (id, data) => Category.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  deleteById: (id) => Category.findByIdAndDelete(id).lean(),
  countEvents: (id) => Event.countDocuments({ category: id }),
};

export const eventRepository = {
  findById: (id) => Event.findById(id).populate(EVENT_POPULATE).lean(),
  findRawById: (id) => Event.findById(id).lean(),
  create: async (data) => (await Event.create(data)).toObject(),
  updateById: (id, update) =>
    Event.findByIdAndUpdate(id, update, { new: true, runValidators: true }).populate(EVENT_POPULATE).lean(),
  deleteById: (id) => Event.findByIdAndDelete(id).lean(),

  /**
   * Atomically change capacity while keeping booked seats constant.
   * Fails (returns null) if the new capacity is below the number of booked seats.
   */
  updateCapacity: (id, capacity) =>
    Event.findOneAndUpdate(
      { _id: oid(id), $expr: { $gte: [capacity, { $subtract: ['$capacity', '$availableSeats'] }] } },
      [{ $set: { availableSeats: { $subtract: [capacity, { $subtract: ['$capacity', '$availableSeats'] }] }, capacity } }],
      { new: true },
    ).lean(),

  /**
   * Atomic seat reservation: a single findOneAndUpdate with the availability
   * condition in the filter. MongoDB applies it as one document-level atomic
   * operation, so two concurrent requests can never both take the last seat.
   */
  reserveSeats: (id, seats, now) =>
    Event.findOneAndUpdate(
      { _id: oid(id), status: EVENT_STATUS.PUBLISHED, startDate: { $gt: now }, availableSeats: { $gte: seats } },
      { $inc: { availableSeats: -seats } },
      { new: true },
    ).lean(),

  /** Give seats back, never exceeding capacity. */
  releaseSeats: (id, seats) =>
    Event.findOneAndUpdate(
      { _id: oid(id), $expr: { $lte: [{ $add: ['$availableSeats', seats] }, '$capacity'] } },
      { $inc: { availableSeats: seats } },
      { new: true },
    ).lean(),

  search: async (filter, { sort, skip, limit, projection }) => {
    const query = Event.find(filter, projection).populate(EVENT_POPULATE).sort(sort).skip(skip).limit(limit);
    const [items, total] = await Promise.all([query.lean(), Event.countDocuments(filter)]);
    return { items, total };
  },
  listByOrganizer: (organizerId, { status } = {}) =>
    Event.find({ organizer: organizerId, ...(status ? { status } : {}) })
      .populate(EVENT_POPULATE)
      .sort({ createdAt: -1 })
      .lean(),
  mapPoints: (now) =>
    Event.find(
      { status: EVENT_STATUS.PUBLISHED, endDate: { $gte: now }, 'venue.location.coordinates.1': { $exists: true } },
      'title startDate venue availableSeats capacity accessibility isFree price category',
    )
      .populate({ path: 'category', select: 'name slug' })
      .sort({ startDate: 1 })
      .limit(200)
      .lean(),
  distinctCities: () => Event.distinct('venue.city', { status: EVENT_STATUS.PUBLISHED }),
};

export const bookingRepository = {
  create: async (data) => (await Booking.create(data)).toObject(),
  findById: (id) => Booking.findById(id).populate({ path: 'event', populate: EVENT_POPULATE }).lean(),
  findRawById: (id) => Booking.findById(id).lean(),
  findActive: (userId, eventId) => Booking.findOne({ user: userId, event: eventId, status: BOOKING_STATUS.CONFIRMED }).lean(),
  /** Atomic status transition confirmed → cancelled. Returns null if already cancelled. */
  cancel: (id, by, now) =>
    Booking.findOneAndUpdate(
      { _id: id, status: BOOKING_STATUS.CONFIRMED },
      { $set: { status: BOOKING_STATUS.CANCELLED, cancelledAt: now, cancelledBy: by } },
      { new: true },
    ).lean(),
  listByUser: async (userId, { status, skip = 0, limit = 50 } = {}) => {
    const filter = { user: userId, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      Booking.find(filter)
        .populate({ path: 'event', populate: EVENT_POPULATE })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);
    return { items, total };
  },
  listConfirmedByUser: (userId) =>
    Booking.find({ user: userId, status: BOOKING_STATUS.CONFIRMED }).populate('event').lean(),
  listByEvent: (eventId, { status } = {}) =>
    Booking.find({ event: eventId, ...(status ? { status } : {}) })
      .populate({ path: 'user', select: 'name email phone preferences.preferredFeatures' })
      .sort({ createdAt: -1 })
      .lean(),
  listConfirmedForEvent: (eventId) => Booking.find({ event: eventId, status: BOOKING_STATUS.CONFIRMED }).lean(),
  countConfirmed: (eventId) => Booking.countDocuments({ event: eventId, status: BOOKING_STATUS.CONFIRMED }),
  setCheckIn: (id, checkedIn, now) =>
    Booking.findOneAndUpdate(
      { _id: id, status: BOOKING_STATUS.CONFIRMED },
      { $set: { checkedIn, checkedInAt: checkedIn ? now : null } },
      { new: true },
    ).lean(),
  /** Confirmed bookings whose event starts inside [from, to] and that have no reminder yet. */
  findDueReminders: async (from, to) => {
    const events = await Event.find({ status: EVENT_STATUS.PUBLISHED, startDate: { $gte: from, $lte: to } }, '_id').lean();
    if (!events.length) return [];
    return Booking.find({ event: { $in: events.map((e) => e._id) }, status: BOOKING_STATUS.CONFIRMED, reminderSentAt: null })
      .populate('event')
      .lean();
  },
  markReminderSent: (id, now) => Booking.updateOne({ _id: id, reminderSentAt: null }, { $set: { reminderSentAt: now } }),
};

export const notificationRepository = {
  create: async (data) => (await Notification.create(data)).toObject(),
  setEmailStatus: (id, emailStatus) => Notification.updateOne({ _id: id }, { $set: { emailStatus } }),
  list: async (userId, { unreadOnly, skip = 0, limit = 20 }) => {
    const filter = { user: userId, ...(unreadOnly ? { read: false } : {}) };
    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    return { items, total };
  },
  countUnread: (userId) => Notification.countDocuments({ user: userId, read: false }),
  markRead: (id, userId, now) =>
    Notification.findOneAndUpdate({ _id: id, user: userId }, { $set: { read: true, readAt: now } }, { new: true }).lean(),
  markAllRead: (userId, now) => Notification.updateMany({ user: userId, read: false }, { $set: { read: true, readAt: now } }),
  deleteById: (id, userId) => Notification.findOneAndDelete({ _id: id, user: userId }).lean(),
};

export const settingRepository = {
  get: async () =>
    Setting.findOneAndUpdate({ key: 'platform' }, { $setOnInsert: { key: 'platform' } }, { new: true, upsert: true }).lean(),
  update: (data) => Setting.findOneAndUpdate({ key: 'platform' }, { $set: data }, { new: true, upsert: true, runValidators: true }).lean(),
};

export const contactRepository = {
  create: async (data) => (await ContactMessage.create(data)).toObject(),
  list: () => ContactMessage.find().sort({ createdAt: -1 }).limit(100).lean(),
  markHandled: (id) => ContactMessage.findByIdAndUpdate(id, { handled: true }, { new: true }).lean(),
};

export const emailLogRepository = {
  create: async (data) => (await EmailLog.create(data)).toObject(),
  list: ({ to, limit = 50 } = {}) => EmailLog.find(to ? { to: String(to).toLowerCase() } : {}).sort({ createdAt: -1 }).limit(limit).lean(),
};

/** Aggregations that feed the dashboards — computed from real data, never hard-coded. */
export const statsRepository = {
  organizerOverview: async (organizerId, now) => {
    const orgId = oid(organizerId);
    const [byStatus] = await Event.aggregate([
      { $match: { organizer: orgId } },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PENDING] }, 1, 0] } },
          drafts: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.DRAFT] }, 1, 0] } },
          upcoming: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, { $gt: ['$startDate', now] }] }, 1, 0] },
          },
          capacity: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, '$capacity', 0] } },
          availableSeats: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, '$availableSeats', 0] } },
        },
      },
    ]);
    const eventIds = await Event.find({ organizer: orgId }).distinct('_id');
    const [bk] = await Booking.aggregate([
      { $match: { event: { $in: eventIds } } },
      {
        $group: {
          _id: null,
          reservations: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CONFIRMED] }, 1, 0] } },
          seatsBooked: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CONFIRMED] }, '$seats', 0] } },
          cancellations: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0] } },
          checkedIn: { $sum: { $cond: [{ $and: [{ $eq: ['$status', BOOKING_STATUS.CONFIRMED] }, '$checkedIn'] }, '$seats', 0] } },
        },
      },
    ]);
    return { ...(byStatus || {}), ...(bk || {}) };
  },
  organizerPerEvent: (organizerId) =>
    Event.aggregate([
      { $match: { organizer: oid(organizerId), status: { $in: [EVENT_STATUS.PUBLISHED, EVENT_STATUS.ARCHIVED] } } },
      {
        $lookup: {
          from: 'bookings',
          let: { eid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$event', '$$eid'] }, { $eq: ['$status', BOOKING_STATUS.CONFIRMED] }] } } },
            { $group: { _id: null, reservations: { $sum: 1 }, seats: { $sum: '$seats' }, checkedIn: { $sum: { $cond: ['$checkedIn', '$seats', 0] } } } },
          ],
          as: 'b',
        },
      },
      { $unwind: { path: '$b', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          startDate: 1,
          status: 1,
          capacity: 1,
          availableSeats: 1,
          reservations: { $ifNull: ['$b.reservations', 0] },
          seatsBooked: { $subtract: ['$capacity', '$availableSeats'] },
          checkedIn: { $ifNull: ['$b.checkedIn', 0] },
        },
      },
      { $sort: { startDate: -1 } },
    ]),
  adminOverview: async (now) => {
    const [users, events, bookings] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            organizers: { $sum: { $cond: [{ $eq: ['$role', 'organizer'] }, 1, 0] } },
            participants: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
            admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
            suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
          },
        },
      ]),
      Event.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PENDING] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.REJECTED] }, 1, 0] } },
            archived: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.ARCHIVED] }, 1, 0] } },
            upcoming: {
              $sum: { $cond: [{ $and: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, { $gt: ['$startDate', now] }] }, 1, 0] },
            },
            capacity: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, '$capacity', 0] } },
            availableSeats: { $sum: { $cond: [{ $eq: ['$status', EVENT_STATUS.PUBLISHED] }, '$availableSeats', 0] } },
          },
        },
      ]),
      Booking.aggregate([
        {
          $group: {
            _id: null,
            confirmed: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CONFIRMED] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0] } },
            seats: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CONFIRMED] }, '$seats', 0] } },
          },
        },
      ]),
    ]);
    return { users: users[0] || {}, events: events[0] || {}, bookings: bookings[0] || {} };
  },
  bookingsPerCategory: () =>
    Booking.aggregate([
      { $match: { status: BOOKING_STATUS.CONFIRMED } },
      { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'e' } },
      { $unwind: '$e' },
      { $lookup: { from: 'categories', localField: 'e.category', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $group: { _id: '$c.name', reservations: { $sum: 1 }, seats: { $sum: '$seats' } } },
      { $sort: { seats: -1 } },
    ]),
  bookingsPerDay: (since) =>
    Booking.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CONFIRMED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  accessibilityCoverage: async () => {
    const { ACCESSIBILITY_KEYS } = await import('../utils/constants.js');
    const group = Object.fromEntries(
      ACCESSIBILITY_KEYS.map((k) => [k, { $sum: { $cond: [`$accessibility.${k}`, 1, 0] } }]),
    );
    const [row] = await Event.aggregate([{ $match: { status: EVENT_STATUS.PUBLISHED } }, { $group: { _id: null, total: { $sum: 1 }, ...group } }]);
    return row || { total: 0 };
  },
  topEvents: (limit = 5) =>
    Event.aggregate([
      { $match: { status: EVENT_STATUS.PUBLISHED } },
      { $addFields: { booked: { $subtract: ['$capacity', '$availableSeats'] } } },
      { $addFields: { occupancy: { $cond: [{ $gt: ['$capacity', 0] }, { $divide: ['$booked', '$capacity'] }, 0] } } },
      { $sort: { booked: -1 } },
      { $limit: limit },
      { $project: { title: 1, startDate: 1, capacity: 1, booked: 1, occupancy: 1 } },
    ]),
};
