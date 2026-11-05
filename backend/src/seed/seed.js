/**
 * Demo data. `npm run seed` inserts data only when the database is empty.
 * `npm run seed -- --reset` wipes the InclusiVenue collections first (explicit flag required).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { User, Event, Booking, Category, Notification, Setting } from '../models/index.js';
import { slugify } from '../services/platform.service.js';
import { CATEGORIES, VENUES, EVENTS, DEMO_PASSWORD, at, feats, makeCover } from './data.js';

export { DEMO_PASSWORD };

export async function seed({ reset = false, uploadDir = process.env.UPLOAD_DIR || 'uploads', withImages = true } = {}) {
  if (reset) {
    await Promise.all([User, Event, Booking, Category, Notification, Setting].map((m) => m.deleteMany({})));
  }
  await Setting.findOneAndUpdate({ key: 'platform' }, { $setOnInsert: { key: 'platform' } }, { upsert: true });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mk = (name, email, role, extra = {}) => ({ name, email, role, passwordHash, ...extra });
  const [admin, orga, orga2, user, user2, user3] = await User.insertMany([
    mk('farah Administratrice', 'admin@inclusivenue.tn', 'admin'),
    mk('Karim Mansour', 'orga@inclusivenue.tn', 'organizer', { organizationName: 'Association Culture Pour Tous', city: 'Tunis' }),
    mk('Leila Trabelsi', 'orga2@inclusivenue.tn', 'organizer', { organizationName: 'Collectif Arts & Signes', city: 'Sousse' }),
    mk('Yasmine Ben Ali', 'user@inclusivenue.tn', 'user', { city: 'Tunis', preferences: { fontScale: 112, preferredFeatures: ['wheelchair'], emailNotifications: true } }),
    mk('Omar Gharbi', 'omar@inclusivenue.tn', 'user', { city: 'Sfax', preferences: { hearingMode: true, preferredFeatures: ['signLanguage', 'subtitles'] } }),
    mk('Nour Jaziri', 'nour@inclusivenue.tn', 'user', { city: 'Sousse', preferences: { screenReaderMode: true, preferredFeatures: ['audioDescription'] } }),
  ]);

  const cats = await Category.insertMany(CATEGORIES.map(([name, description]) => ({ name, slug: slugify(name), description })));
  const catId = Object.fromEntries(cats.map((c) => [c.name, c._id]));

  const dir = path.resolve(uploadDir);
  const docs = [];
  for (const [i, [title, cat, vKey, d, h, dur, price, cap, f, desc]] of EVENTS.entries()) {
    const v = VENUES[vKey];
    const url = withImages ? await makeCover(dir, title, cat, i) : '';
    docs.push({
      title,
      summary: desc.split('.')[0] + '.',
      description: `${desc}\n\nAccueil par des bénévoles formés à l’accompagnement. Merci de préciser vos besoins lors de la réservation afin que nous puissions vous accueillir dans les meilleures conditions.`,
      category: catId[cat],
      startDate: at(d, h),
      endDate: new Date(at(d, h).getTime() + dur * 3600 * 1000),
      venue: { name: v.name, address: v.address, city: v.city, location: { type: 'Point', coordinates: [v.lng, v.lat] }, accessInstructions: v.access },
      organizer: i % 3 === 2 ? orga2._id : orga._id,
      price,
      isFree: price === 0,
      capacity: cap,
      availableSeats: cap,
      coverImage: { url, alt: url ? `Visuel de l'événement « ${title} » : bandeau bleu avec la catégorie ${cat}.` : '' },
      accessibility: feats(...f),
      accessibilityNotes: 'Contactez l’organisateur pour toute demande spécifique (accompagnateur, place réservée, documents adaptés).',
      status: 'published',
      publishedAt: new Date(),
      moderation: { moderatedBy: admin._id, moderatedAt: new Date() },
    });
  }
  // One pending and one draft event to demonstrate moderation.
  docs.push(
    {
      ...docs[0],
      title: 'Atelier théâtre forum : prendre la parole',
      summary: 'Un atelier de théâtre forum pour s’exprimer en public.',
      startDate: at(22, 14),
      endDate: at(22, 17),
      status: 'pending',
      publishedAt: undefined,
      coverImage: { url: '', alt: '' },
      moderation: { submittedAt: new Date() },
    },
    {
      ...docs[1],
      title: 'Projection plein air (brouillon)',
      summary: 'Brouillon en cours de préparation.',
      startDate: at(40, 20),
      endDate: at(40, 22),
      status: 'draft',
      publishedAt: undefined,
      coverImage: { url: '', alt: '' },
      moderation: {},
    },
  );
  const events = await Event.insertMany(docs);

  // A few real bookings (seats decremented accordingly).
  const bookings = [
    [user, events[1], 2, ['wheelchair']],
    [user, events[3], 1, []],
    [user2, events[1], 1, ['signLanguage']],
    [user2, events[9], 2, ['signLanguage']],
    [user3, events[2], 1, ['audioDescription']],
    [user3, events[4], 2, []],
  ];
  let n = 0;
  for (const [u, e, seats, needs] of bookings) {
    n += 1;
    await Booking.create({ user: u._id, event: e._id, seats, accessibilityNeeds: needs, reference: `IV-DEMO${String(n).padStart(3, '0')}`, unitPrice: e.price });
    await Event.updateOne({ _id: e._id }, { $inc: { availableSeats: -seats } });
    await Notification.create({ user: u._id, type: 'booking_confirmed', title: 'Réservation confirmée', message: `Votre réservation pour « ${e.title} » est confirmée.`, link: '/mon-espace/reservations' });
  }
  await Notification.create({ user: admin._id, type: 'event_submitted', title: 'Événement à modérer', message: `« ${docs[docs.length - 2].title} » attend votre validation.`, link: '/admin/moderation' });

  return { users: 6, categories: cats.length, events: events.length, bookings: bookings.length };
}

export async function seedIfEmpty(opts) {
  if ((await User.estimatedDocumentCount()) > 0) return null;
  const r = await seed(opts);
  console.log('[seed] demo data inserted', r);
  return r;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { env } = await import('../config/env.js');
  const { connectDb, disconnectDb } = await import('../config/db.js');
  await connectDb(env.MONGO_URL);
  const reset = process.argv.includes('--reset');
  const r = reset ? await seed({ reset: true, uploadDir: env.UPLOAD_DIR }) : await seedIfEmpty({ uploadDir: env.UPLOAD_DIR });
  console.log(r ? `[seed] done: ${JSON.stringify(r)}` : '[seed] database not empty — nothing inserted (use --reset to wipe and reseed)');
  await disconnectDb();
}
