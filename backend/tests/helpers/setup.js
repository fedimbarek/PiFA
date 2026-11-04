import { createFakeDb, fakeHasher, fakeTokens, futureDate } from './fakes.js';
import { createMailService } from '../../src/services/mail.service.js';
import { createNotificationService } from '../../src/services/notification.service.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createUserService } from '../../src/services/user.service.js';
import { createEventService } from '../../src/services/event.service.js';
import { createBookingService } from '../../src/services/booking.service.js';
import { createCategoryService } from '../../src/services/platform.service.js';

const silent = { info() {}, error() {}, warn() {} };

export function setup({ clock } = {}) {
  const f = createFakeDb();
  const mail = createMailService({ mode: 'log', emailLogRepo: f.emailLogRepo, logger: silent });
  const notifications = createNotificationService({ notificationRepo: f.notificationRepo, userRepo: f.userRepo, mailService: mail, appUrl: 'http://app' });
  const deps = { ...f, settingsService: f.settingsService, notificationService: notifications, ...(clock ? { clock } : {}) };
  const services = {
    mail,
    notifications,
    auth: createAuthService({ userRepo: f.userRepo, hasher: fakeHasher, tokens: fakeTokens, mailService: mail, settingsService: f.settingsService, appUrl: 'http://app', ...(clock ? { clock } : {}) }),
    users: createUserService({ userRepo: f.userRepo }),
    categories: createCategoryService({ categoryRepo: f.categoryRepo }),
    events: createEventService(deps),
    bookings: createBookingService(deps),
  };

  const users = {};
  const makeUser = async (role, name = role) => {
    const u = await f.userRepo.create({ name, email: `${name}@test.tn`, passwordHash: 'hashed:Secret123', role });
    return { id: u._id, role, name };
  };

  async function fixtures() {
    users.admin = await makeUser('admin');
    users.orga = await makeUser('organizer', 'orga');
    users.orga2 = await makeUser('organizer', 'orga2');
    users.user = await makeUser('user');
    users.user2 = await makeUser('user', 'user2');
    const cat = await f.categoryRepo.create({ name: 'Atelier', slug: 'atelier' });
    return { users, cat };
  }

  const eventInput = (cat, over = {}) => ({
    title: 'Atelier test accessible',
    description: 'Une description suffisamment longue pour passer.',
    category: cat._id,
    startDate: futureDate(5),
    endDate: futureDate(5, 2),
    venue: { name: 'Lieu', address: '1 rue', city: 'Tunis', latitude: 36.8, longitude: 10.18 },
    price: 0,
    capacity: 3,
    accessibility: { wheelchair: true },
    ...over,
  });

  /** Create and publish an event owned by `owner`. */
  async function publishedEvent(owner, cat, over) {
    const e = await services.events.create(owner, eventInput(cat, over));
    await f.eventRepo.updateById(e.id, { $set: { status: 'published' } });
    return e;
  }

  return { f, services, users, fixtures, eventInput, publishedEvent, makeUser };
}
