/**
 * In-memory fakes of the repositories used by the services. They mirror the
 * contracts of src/repositories/index.js (including the conditional atomic
 * updates), so business rules can be unit-tested without MongoDB.
 */
import crypto from 'node:crypto';

export const newId = () => crypto.randomBytes(12).toString('hex');
const clone = (x) => (x === undefined ? x : structuredClone(x));
const tick = () => new Promise((r) => setImmediate(r));

export function createFakeDb() {
  const db = { users: new Map(), events: new Map(), bookings: new Map(), notifications: [], categories: new Map(), emails: [], settings: { requireModeration: true, maxSeatsPerBooking: 4, cancellationDeadlineHours: 2, allowOrganizerSignup: true } };

  const userRepo = {
    findById: async (id) => {
      const u = db.users.get(String(id));
      if (!u) return null;
      const { passwordHash: _p, passwordReset: _r, ...rest } = u;
      return clone(rest);
    },
    findByIdWithPassword: async (id) => clone(db.users.get(String(id)) || null),
    findByEmail: async (email, { withPassword } = {}) => {
      const u = [...db.users.values()].find((x) => x.email === String(email).toLowerCase());
      if (!u) return null;
      if (withPassword) return clone(u);
      const { passwordHash: _p, ...rest } = u;
      return clone(rest);
    },
    existsByEmail: async (email) => [...db.users.values()].some((x) => x.email === String(email).toLowerCase()),
    create: async (data) => {
      const u = { _id: newId(), status: 'active', preferences: { emailNotifications: true, fontScale: 100 }, createdAt: new Date(), ...data, email: data.email.toLowerCase() };
      db.users.set(u._id, u);
      return clone(u);
    },
    updateById: async (id, update) => {
      const u = db.users.get(String(id));
      if (!u) return null;
      const set = update.$set || update;
      for (const [k, v] of Object.entries(set)) u[k] = clone(v);
      const { passwordHash: _p, ...rest } = u;
      return clone(rest);
    },
    deleteById: async (id) => {
      const u = db.users.get(String(id));
      db.users.delete(String(id));
      return u || null;
    },
    setResetToken: async (id, tokenHash, expiresAt) => {
      db.users.get(String(id)).passwordReset = { tokenHash, expiresAt };
    },
    findByResetTokenHash: async (hash, now) =>
      clone([...db.users.values()].find((u) => u.passwordReset?.tokenHash === hash && u.passwordReset.expiresAt > now) || null),
    setPassword: async (id, passwordHash, now) => {
      const u = db.users.get(String(id));
      u.passwordHash = passwordHash;
      u.passwordChangedAt = now;
      delete u.passwordReset;
    },
    list: async () => ({ items: [...db.users.values()].map(clone), total: db.users.size }),
    findAdmins: async () => [...db.users.values()].filter((u) => u.role === 'admin').map(clone),
  };

  const categoryRepo = {
    list: async () => [...db.categories.values()].map(clone),
    findById: async (id) => clone(db.categories.get(String(id)) || null),
    create: async (d) => {
      if ([...db.categories.values()].some((c) => c.slug === d.slug)) throw Object.assign(new Error('dup'), { code: 11000 });
      const c = { _id: newId(), active: true, ...d };
      db.categories.set(c._id, c);
      return clone(c);
    },
    updateById: async (id, d) => {
      const c = db.categories.get(String(id));
      if (!c) return null;
      Object.assign(c, d);
      return clone(c);
    },
    deleteById: async (id) => {
      const c = db.categories.get(String(id));
      db.categories.delete(String(id));
      return c || null;
    },
    countEvents: async (id) => [...db.events.values()].filter((e) => String(e.category) === String(id)).length,
  };

  const applySet = (obj, set) => {
    for (const [k, v] of Object.entries(set)) {
      const parts = k.split('.');
      let t = obj;
      while (parts.length > 1) {
        const p = parts.shift();
        t[p] = t[p] ?? {};
        t = t[p];
      }
      t[parts[0]] = clone(v);
    }
  };

  const eventRepo = {
    findById: async (id) => clone(db.events.get(String(id)) || null),
    findRawById: async (id) => clone(db.events.get(String(id)) || null),
    create: async (d) => {
      const e = { _id: newId(), createdAt: new Date(), ...clone(d) };
      db.events.set(e._id, e);
      return clone(e);
    },
    updateById: async (id, update) => {
      const e = db.events.get(String(id));
      if (!e) return null;
      applySet(e, update.$set || update);
      return clone(e);
    },
    deleteById: async (id) => {
      const e = db.events.get(String(id));
      db.events.delete(String(id));
      return e || null;
    },
    updateCapacity: async (id, capacity) => {
      const e = db.events.get(String(id));
      const booked = e.capacity - e.availableSeats;
      if (capacity < booked) return null;
      e.capacity = capacity;
      e.availableSeats = capacity - booked;
      return clone(e);
    },
    // Check-and-decrement happens synchronously after the await → atomic, like MongoDB.
    reserveSeats: async (id, seats, now) => {
      await tick();
      const e = db.events.get(String(id));
      if (!e || e.status !== 'published' || !(new Date(e.startDate) > now) || e.availableSeats < seats) return null;
      e.availableSeats -= seats;
      return clone(e);
    },
    releaseSeats: async (id, seats) => {
      const e = db.events.get(String(id));
      if (!e || e.availableSeats + seats > e.capacity) return null;
      e.availableSeats += seats;
      return clone(e);
    },
    search: async (_f, { skip = 0, limit = 12 } = {}) => {
      const all = [...db.events.values()];
      return { items: all.slice(skip, skip + limit).map(clone), total: all.length };
    },
    listByOrganizer: async (orgId) => [...db.events.values()].filter((e) => String(e.organizer) === String(orgId)).map(clone),
    mapPoints: async () => [...db.events.values()].filter((e) => e.status === 'published').map(clone),
    distinctCities: async () => [...new Set([...db.events.values()].map((e) => e.venue?.city))],
  };

  const bookingRepo = {
    create: async (d) => {
      await tick();
      const dup = [...db.bookings.values()].some((b) => b.user === d.user && b.event === d.event && b.status === 'confirmed');
      if (dup) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const b = { _id: newId(), createdAt: new Date(), checkedIn: false, reminderSentAt: null, ...clone(d) };
      db.bookings.set(b._id, b);
      return clone(b);
    },
    findById: async (id) => {
      const b = db.bookings.get(String(id));
      return b ? { ...clone(b), event: clone(db.events.get(String(b.event))) } : null;
    },
    findRawById: async (id) => clone(db.bookings.get(String(id)) || null),
    findActive: async (u, e) => clone([...db.bookings.values()].find((b) => String(b.user) === String(u) && String(b.event) === String(e) && b.status === 'confirmed') || null),
    cancel: async (id, by, now) => {
      const b = db.bookings.get(String(id));
      if (!b || b.status !== 'confirmed') return null;
      Object.assign(b, { status: 'cancelled', cancelledBy: by, cancelledAt: now });
      return clone(b);
    },
    listByUser: async (u) => {
      const items = [...db.bookings.values()].filter((b) => String(b.user) === String(u)).map(clone);
      return { items, total: items.length };
    },
    listConfirmedByUser: async (u) =>
      [...db.bookings.values()]
        .filter((b) => String(b.user) === String(u) && b.status === 'confirmed')
        .map((b) => ({ ...clone(b), event: clone(db.events.get(String(b.event))) })),
    listByEvent: async (e) => [...db.bookings.values()].filter((b) => String(b.event) === String(e)).map(clone),
    listConfirmedForEvent: async (e) => [...db.bookings.values()].filter((b) => String(b.event) === String(e) && b.status === 'confirmed').map(clone),
    countConfirmed: async (e) => [...db.bookings.values()].filter((b) => String(b.event) === String(e) && b.status === 'confirmed').length,
    setCheckIn: async (id, checkedIn, now) => {
      const b = db.bookings.get(String(id));
      if (!b || b.status !== 'confirmed') return null;
      Object.assign(b, { checkedIn, checkedInAt: checkedIn ? now : null });
      return clone(b);
    },
    findDueReminders: async (from, to) =>
      [...db.bookings.values()]
        .filter((b) => {
          const e = db.events.get(String(b.event));
          return b.status === 'confirmed' && !b.reminderSentAt && e && new Date(e.startDate) >= from && new Date(e.startDate) <= to;
        })
        .map((b) => ({ ...clone(b), event: clone(db.events.get(String(b.event))) })),
    markReminderSent: async (id, now) => {
      const b = db.bookings.get(String(id));
      if (b.reminderSentAt) return { modifiedCount: 0 };
      b.reminderSentAt = now;
      return { modifiedCount: 1 };
    },
  };

  const notificationRepo = {
    create: async (d) => {
      const n = { _id: newId(), read: false, emailStatus: 'none', createdAt: new Date(), ...d };
      db.notifications.push(n);
      return clone(n);
    },
    setEmailStatus: async (id, s) => {
      const n = db.notifications.find((x) => x._id === id);
      if (n) n.emailStatus = s;
    },
    list: async (u, { unreadOnly }) => {
      const items = db.notifications.filter((n) => String(n.user) === String(u) && (!unreadOnly || !n.read));
      return { items: items.map(clone), total: items.length };
    },
    countUnread: async (u) => db.notifications.filter((n) => String(n.user) === String(u) && !n.read).length,
    markRead: async (id, u) => {
      const n = db.notifications.find((x) => x._id === id && String(x.user) === String(u));
      if (!n) return null;
      n.read = true;
      return clone(n);
    },
    markAllRead: async (u) => db.notifications.filter((n) => String(n.user) === String(u)).forEach((n) => (n.read = true)),
    deleteById: async (id, u) => {
      const i = db.notifications.findIndex((x) => x._id === id && String(x.user) === String(u));
      return i >= 0 ? db.notifications.splice(i, 1)[0] : null;
    },
  };

  const settingsService = { get: async () => clone(db.settings), update: async (d) => Object.assign(db.settings, d) };
  const emailLogRepo = { create: async (d) => db.emails.push(d) };

  return { db, userRepo, categoryRepo, eventRepo, bookingRepo, notificationRepo, settingsService, emailLogRepo };
}

/** Deterministic "hasher" for unit tests (bcrypt itself is exercised in integration tests). */
export const fakeHasher = {
  hash: async (s) => `hashed:${s}`,
  compare: async (s, h) => h === `hashed:${s}`,
};
export const fakeTokens = {
  sign: (p) => Buffer.from(JSON.stringify({ ...p, iat: Math.floor(Date.now() / 1000) })).toString('base64url'),
  verify: (t) => JSON.parse(Buffer.from(t, 'base64url').toString()),
};

export const futureDate = (days, hours = 0) => new Date(Date.now() + days * 86400000 + hours * 3600000);
