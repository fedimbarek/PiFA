import { Router } from 'express';
import { asyncHandler as h } from '../utils/errors.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/common.js';
import { createUploader } from '../middleware/upload.js';
import * as s from '../validators/schemas.js';

/**
 * REST routes. Every protected route enforces authentication (`auth.required`) and,
 * where relevant, the role (`authorize(...)`). Ownership rules are enforced again
 * inside the services.
 */
export function createRoutes({ c, auth, env, authLimiter }) {
  const r = Router();
  const ORG = ['organizer', 'admin'];
  const id = validate({ params: s.idParams });
  const upload = createUploader({ maxMb: env.MAX_UPLOAD_MB });

  // ---- Auth
  r.post('/auth/register', authLimiter, validate({ body: s.registerSchema }), h(c.auth.register));
  r.post('/auth/login', authLimiter, validate({ body: s.loginSchema }), h(c.auth.login));
  r.post('/auth/logout', h(c.auth.logout));
  r.get('/auth/me', auth.required, h(c.auth.me));
  r.post('/auth/forgot-password', authLimiter, validate({ body: s.forgotPasswordSchema }), h(c.auth.forgotPassword));
  r.post('/auth/reset-password', authLimiter, validate({ body: s.resetPasswordSchema }), h(c.auth.resetPassword));
  r.post('/auth/change-password', auth.required, authLimiter, validate({ body: s.changePasswordSchema }), h(c.auth.changePassword));

  // ---- Current user
  r.get('/users/me', auth.required, h(c.users.getMe));
  r.patch('/users/me', auth.required, validate({ body: s.profileSchema }), h(c.users.updateMe));
  r.get('/users/me/preferences', auth.required, h(c.users.getPreferences));
  r.put('/users/me/preferences', auth.required, validate({ body: s.preferencesSchema }), h(c.users.updatePreferences));

  // ---- Reference data
  r.get('/meta/accessibility-features', h(c.meta.accessibilityFeatures));
  r.get('/meta/cities', h(c.meta.cities));
  r.get('/categories', auth.optional, h(c.categories.list));
  r.post('/categories', auth.required, authorize('admin'), validate({ body: s.categorySchema }), h(c.categories.create));
  r.patch('/categories/:id', auth.required, authorize('admin'), id, validate({ body: s.categoryUpdateSchema }), h(c.categories.update));
  r.delete('/categories/:id', auth.required, authorize('admin'), id, h(c.categories.remove));

  // ---- Events
  r.get('/events', validate({ query: s.eventQuerySchema }), h(c.events.search));
  r.get('/events/map', h(c.events.map));
  r.get('/events/:id', id, auth.optional, h(c.events.get));
  r.post('/events', auth.required, authorize(...ORG), validate({ body: s.createEventSchema }), h(c.events.create));
  r.patch('/events/:id', auth.required, authorize(...ORG), id, validate({ body: s.updateEventSchema }), h(c.events.update));
  r.delete('/events/:id', auth.required, authorize(...ORG), id, h(c.events.remove));
  r.post('/events/:id/submit', auth.required, authorize(...ORG), id, h(c.events.submit));
  r.post('/events/:id/unsubmit', auth.required, authorize(...ORG), id, h(c.events.unsubmit));
  r.post('/events/:id/archive', auth.required, authorize(...ORG), id, h(c.events.archive));
  r.post('/events/:id/image', auth.required, authorize(...ORG), id, upload, h(c.events.uploadImage));
  r.get('/events/:id/reservations', auth.required, authorize(...ORG), id, h(c.events.reservations));

  // ---- Bookings
  r.post('/bookings', auth.required, validate({ body: s.createBookingSchema }), h(c.bookings.create));
  r.get('/bookings/me', auth.required, validate({ query: s.listQuery }), h(c.bookings.mine));
  r.get('/bookings/me/calendar.ics', auth.required, h(c.bookings.calendar));
  r.get('/bookings/:id', auth.required, id, h(c.bookings.get));
  r.get('/bookings/:id/calendar.ics', auth.required, id, h(c.bookings.calendarOne));
  r.post('/bookings/:id/cancel', auth.required, id, h(c.bookings.cancel));
  r.patch('/bookings/:id/check-in', auth.required, authorize(...ORG), id, validate({ body: s.checkInSchema }), h(c.bookings.checkIn));

  // ---- Notifications
  r.get('/notifications', auth.required, validate({ query: s.listQuery }), h(c.notifications.list));
  r.get('/notifications/unread-count', auth.required, h(c.notifications.unreadCount));
  r.post('/notifications/read-all', auth.required, h(c.notifications.markAllRead));
  r.patch('/notifications/:id/read', auth.required, id, h(c.notifications.markRead));
  r.delete('/notifications/:id', auth.required, id, h(c.notifications.remove));

  // ---- Organizer space
  r.get('/organizer/events', auth.required, authorize(...ORG), h(c.organizer.events));
  r.get('/organizer/stats', auth.required, authorize(...ORG), h(c.organizer.stats));

  // ---- Administration
  const ADMIN = [auth.required, authorize('admin')];
  r.get('/admin/stats', ...ADMIN, h(c.admin.stats));
  r.get('/admin/users', ...ADMIN, validate({ query: s.adminUserQuery }), h(c.users.adminList));
  r.patch('/admin/users/:id', ...ADMIN, id, validate({ body: s.adminUserUpdate }), h(c.users.adminUpdate));
  r.delete('/admin/users/:id', ...ADMIN, id, h(c.users.adminDelete));
  r.get('/admin/events', ...ADMIN, validate({ query: s.adminEventQuery }), h(c.admin.events));
  r.post('/admin/events/:id/approve', ...ADMIN, id, h(c.admin.approve));
  r.post('/admin/events/:id/reject', ...ADMIN, id, validate({ body: s.rejectSchema }), h(c.admin.reject));
  r.post('/admin/events/:id/restore', ...ADMIN, id, h(c.admin.restore));
  r.get('/admin/settings', ...ADMIN, h(c.admin.getSettings));
  r.put('/admin/settings', ...ADMIN, validate({ body: s.settingsSchema }), h(c.admin.updateSettings));
  r.get('/admin/contact-messages', ...ADMIN, h(c.admin.contactMessages));
  r.patch('/admin/contact-messages/:id/handled', ...ADMIN, id, h(c.admin.handleContact));
  r.post('/admin/reminders/run', ...ADMIN, h(c.admin.runReminders));

  // ---- Contact
  r.post('/contact', authLimiter, validate({ body: s.contactSchema }), h(c.contact.submit));

  // ---- Development outbox (MAIL_MODE=log, never in production)
  if (env.NODE_ENV !== 'production' && env.MAIL_MODE === 'log') {
    r.get('/dev/outbox', h(c.dev.outbox));
  }

  return r;
}
