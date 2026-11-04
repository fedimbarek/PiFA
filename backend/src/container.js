/**
 * Composition root: wires repositories, infrastructure adapters and services.
 * Tests can call buildContainer() with overrides.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import * as repos from './repositories/index.js';
import { createMailService } from './services/mail.service.js';
import { createNotificationService } from './services/notification.service.js';
import { createAuthService } from './services/auth.service.js';
import { createUserService } from './services/user.service.js';
import { createEventService } from './services/event.service.js';
import { createBookingService } from './services/booking.service.js';
import { createStatsService } from './services/stats.service.js';
import { createSettingsService, createCategoryService, createContactService } from './services/platform.service.js';
import { createAuthMiddleware } from './middleware/auth.js';

export function buildContainer(env, overrides = {}) {
  const hasher = overrides.hasher || {
    hash: (s) => bcrypt.hash(s, env.NODE_ENV === 'test' ? 4 : 12),
    compare: (s, h) => bcrypt.compare(s, h),
  };
  const tokens = overrides.tokens || {
    sign: (payload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: 'inclusivenue' }),
    verify: (token) => jwt.verify(token, env.JWT_SECRET, { issuer: 'inclusivenue', algorithms: ['HS256'] }),
  };
  const transport =
    env.MAIL_MODE === 'smtp' && env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT || 587,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        })
      : null;

  const appUrl = env.CLIENT_URL;
  const clock = overrides.clock || (() => new Date());
  const mailService = createMailService({ mode: env.MAIL_MODE, transport, from: env.MAIL_FROM, emailLogRepo: repos.emailLogRepository, logger: overrides.logger || console });
  const settingsService = createSettingsService({ settingRepo: repos.settingRepository, ttlMs: env.NODE_ENV === 'test' ? 0 : 30_000 });
  const notificationService = createNotificationService({ notificationRepo: repos.notificationRepository, userRepo: repos.userRepository, mailService, appUrl, clock });

  const services = {
    mail: mailService,
    settings: settingsService,
    notifications: notificationService,
    auth: createAuthService({ userRepo: repos.userRepository, hasher, tokens, mailService, settingsService, appUrl, clock }),
    users: createUserService({ userRepo: repos.userRepository }),
    categories: createCategoryService({ categoryRepo: repos.categoryRepository }),
    contact: createContactService({ contactRepo: repos.contactRepository, notificationService }),
    events: createEventService({
      eventRepo: repos.eventRepository,
      bookingRepo: repos.bookingRepository,
      categoryRepo: repos.categoryRepository,
      settingsService,
      notificationService,
      clock,
    }),
    bookings: createBookingService({
      eventRepo: repos.eventRepository,
      bookingRepo: repos.bookingRepository,
      settingsService,
      notificationService,
      clock,
      appUrl,
    }),
    stats: createStatsService({ statsRepo: repos.statsRepository, clock }),
  };

  const auth = createAuthMiddleware({ verify: tokens.verify, userRepo: repos.userRepository });
  return { env, repos, services, auth, hasher, tokens };
}
