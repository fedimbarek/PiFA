/**
 * HTTP controllers: translate requests into service calls and service results into
 * HTTP responses. No business rules live here.
 */
import { AUTH_COOKIE } from '../middleware/auth.js';
import { processAndStoreImage } from '../middleware/upload.js';
import { ACCESSIBILITY_FEATURES } from '../utils/constants.js';

export function createControllers({ services, env, repos }) {
  const cookieOpts = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
  };
  const sendAuth = (res, status, { user, token }) => {
    res.cookie(AUTH_COOKIE, token, cookieOpts);
    res.status(status).json({ user, token });
  };

  const auth = {
    register: async (req, res) => sendAuth(res, 201, await services.auth.register(req.body)),
    login: async (req, res) => sendAuth(res, 200, await services.auth.login(req.body)),
    logout: async (_req, res) => {
      res.clearCookie(AUTH_COOKIE, { ...cookieOpts, maxAge: undefined });
      res.status(204).end();
    },
    me: async (req, res) => res.json({ user: await services.auth.me(req.user.id) }),
    forgotPassword: async (req, res) => res.json(await services.auth.forgotPassword(req.body)),
    resetPassword: async (req, res) => res.json(await services.auth.resetPassword(req.body)),
    changePassword: async (req, res) => {
      const out = await services.auth.changePassword(req.user.id, req.body);
      res.clearCookie(AUTH_COOKIE, { ...cookieOpts, maxAge: undefined });
      res.json(out);
    },
  };

  const users = {
    getMe: async (req, res) => res.json({ user: await services.users.getProfile(req.user.id) }),
    updateMe: async (req, res) => res.json({ user: await services.users.updateProfile(req.user, req.body) }),
    getPreferences: async (req, res) => res.json({ preferences: (await services.users.getProfile(req.user.id)).preferences }),
    updatePreferences: async (req, res) => res.json({ preferences: await services.users.updatePreferences(req.user.id, req.body) }),
    adminList: async (req, res) => res.json(await services.users.list(req.validatedQuery)),
    adminUpdate: async (req, res) => res.json({ user: await services.users.adminUpdate(req.user, req.params.id, req.body) }),
    adminDelete: async (req, res) => {
      await services.users.adminDelete(req.user, req.params.id);
      res.status(204).end();
    },
  };

  const meta = {
    accessibilityFeatures: (_req, res) =>
      res.json({ features: Object.entries(ACCESSIBILITY_FEATURES).map(([key, label]) => ({ key, label })) }),
    cities: async (_req, res) => res.json({ cities: await services.events.cities() }),
  };

  const categories = {
    list: async (req, res) =>
      res.json({ categories: await services.categories.list({ includeInactive: req.user?.role === 'admin' && req.query.all === 'true' }) }),
    create: async (req, res) => res.status(201).json({ category: await services.categories.create(req.body) }),
    update: async (req, res) => res.json({ category: await services.categories.update(req.params.id, req.body) }),
    remove: async (req, res) => {
      await services.categories.remove(req.params.id);
      res.status(204).end();
    },
  };

  const events = {
    search: async (req, res) => {
      res.set('Cache-Control', 'public, max-age=30');
      res.json(await services.events.search(req.validatedQuery));
    },
    map: async (_req, res) => {
      res.set('Cache-Control', 'public, max-age=60');
      res.json({ items: await services.events.mapPoints() });
    },
    get: async (req, res) => {
      if (!req.user) res.set('Cache-Control', 'public, max-age=30');
      res.json({ event: await services.events.getById(req.user, req.params.id) });
    },
    create: async (req, res) => res.status(201).json({ event: await services.events.create(req.user, req.body) }),
    update: async (req, res) => res.json({ event: await services.events.update(req.user, req.params.id, req.body) }),
    remove: async (req, res) => {
      await services.events.remove(req.user, req.params.id);
      res.status(204).end();
    },
    submit: async (req, res) => res.json({ event: await services.events.submit(req.user, req.params.id) }),
    unsubmit: async (req, res) => res.json({ event: await services.events.unsubmit(req.user, req.params.id) }),
    archive: async (req, res) => res.json({ event: await services.events.archive(req.user, req.params.id) }),
    uploadImage: async (req, res) => {
      // Ownership is checked before writing anything to disk.
      await services.events.assertManageable(req.user, req.params.id);
      const stored = await processAndStoreImage(req.file, env.UPLOAD_DIR);
      const alt = typeof req.body?.alt === 'string' ? req.body.alt.slice(0, 250) : undefined;
      res.json({ event: await services.events.setCover(req.user, req.params.id, { url: stored.url, alt }) });
    },
    reservations: async (req, res) => res.json(await services.events.reservationsForEvent(req.user, req.params.id)),
  };

  const bookings = {
    create: async (req, res) => res.status(201).json({ booking: await services.bookings.create(req.user, req.body) }),
    mine: async (req, res) => res.json(await services.bookings.listMine(req.user, req.validatedQuery)),
    get: async (req, res) => res.json({ booking: await services.bookings.getById(req.user, req.params.id) }),
    cancel: async (req, res) => res.json({ booking: await services.bookings.cancel(req.user, req.params.id) }),
    checkIn: async (req, res) => res.json({ booking: await services.bookings.checkIn(req.user, req.params.id, req.body.checkedIn) }),
    calendar: async (req, res) => {
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="inclusivenue-reservations.ics"');
      res.send(await services.bookings.calendarForUser(req.user));
    },
    calendarOne: async (req, res) => {
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="reservation-${req.params.id}.ics"`);
      res.send(await services.bookings.calendarForBooking(req.user, req.params.id));
    },
  };

  const notifications = {
    list: async (req, res) => res.json(await services.notifications.list(req.user.id, req.validatedQuery)),
    unreadCount: async (req, res) => res.json({ unread: await services.notifications.unreadCount(req.user.id) }),
    markRead: async (req, res) => res.json({ notification: await services.notifications.markRead(req.user.id, req.params.id) }),
    markAllRead: async (req, res) => res.json(await services.notifications.markAllRead(req.user.id)),
    remove: async (req, res) => {
      await services.notifications.remove(req.user.id, req.params.id);
      res.status(204).end();
    },
  };

  const organizer = {
    events: async (req, res) => res.json({ items: await services.events.listForOrganizer(req.user, { status: req.query.status }) }),
    stats: async (req, res) => res.json({ stats: await services.stats.organizer(req.user.id) }),
  };

  const admin = {
    stats: async (_req, res) => res.json({ stats: await services.stats.admin() }),
    events: async (req, res) => res.json(await services.events.listForAdmin(req.validatedQuery)),
    approve: async (req, res) => res.json({ event: await services.events.approve(req.user, req.params.id) }),
    reject: async (req, res) => res.json({ event: await services.events.reject(req.user, req.params.id, req.body.reason) }),
    restore: async (req, res) => res.json({ event: await services.events.restoreDraft(req.user, req.params.id) }),
    getSettings: async (_req, res) => res.json({ settings: await services.settings.get() }),
    updateSettings: async (req, res) => res.json({ settings: await services.settings.update(req.body) }),
    contactMessages: async (_req, res) => res.json({ items: await services.contact.list() }),
    handleContact: async (req, res) => res.json({ item: await services.contact.markHandled(req.params.id) }),
    runReminders: async (_req, res) => res.json(await services.bookings.sendReminders(24)),
  };

  const contact = {
    submit: async (req, res) => res.status(201).json(await services.contact.submit(req.body)),
  };

  const dev = {
    outbox: async (req, res) => res.json({ mode: services.mail.mode, items: await repos.emailLogRepository.list({ to: req.query.to }) }),
  };

  return { auth, users, meta, categories, events, bookings, notifications, organizer, admin, contact, dev };
}
