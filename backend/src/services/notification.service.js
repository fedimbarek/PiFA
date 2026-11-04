import { paginate, pageResult } from '../utils/pagination.js';
import { notFound } from '../utils/errors.js';

/**
 * In-app notifications, optionally mirrored by email (respecting the user's
 * "emailNotifications" preference).
 */
export function createNotificationService({ notificationRepo, userRepo, mailService, appUrl = '', clock = () => new Date() }) {
  async function notify(userId, { type, title, message, link = '' }, { email = true } = {}) {
    const notification = await notificationRepo.create({ user: userId, type, title, message, link });
    let emailStatus = 'none';
    if (email && mailService) {
      const user = await userRepo.findById(userId);
      if (!user) return notification;
      if (user.preferences?.emailNotifications === false) {
        emailStatus = 'disabled';
      } else {
        const text = `Bonjour ${user.name},\n\n${message}\n\n${link ? `${appUrl}${link}\n\n` : ''}— L'équipe InclusiVenue`;
        emailStatus = await mailService.send({ to: user.email, subject: `InclusiVenue — ${title}`, text });
      }
      await notificationRepo.setEmailStatus(notification._id, emailStatus);
    }
    return { ...notification, emailStatus };
  }

  async function notifyAdmins(payload, opts) {
    const admins = await userRepo.findAdmins();
    return Promise.all(admins.map((a) => notify(a._id, payload, opts)));
  }

  async function list(userId, query = {}) {
    const p = paginate(query);
    const { items, total } = await notificationRepo.list(userId, { unreadOnly: query.unread === 'true', skip: p.skip, limit: p.limit });
    const unread = await notificationRepo.countUnread(userId);
    return { ...pageResult(items, total, p), unread };
  }

  const unreadCount = (userId) => notificationRepo.countUnread(userId);

  async function markRead(userId, id) {
    const n = await notificationRepo.markRead(id, userId, clock());
    if (!n) throw notFound('Notification introuvable.');
    return n;
  }

  async function markAllRead(userId) {
    await notificationRepo.markAllRead(userId, clock());
    return { ok: true };
  }

  async function remove(userId, id) {
    const n = await notificationRepo.deleteById(id, userId);
    if (!n) throw notFound('Notification introuvable.');
  }

  return { notify, notifyAdmins, list, unreadCount, markRead, markAllRead, remove };
}
