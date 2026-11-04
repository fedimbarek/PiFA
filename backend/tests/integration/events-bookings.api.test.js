import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { startHarness } from '../helpers/integration.js';
import { Event, Booking } from '../../src/models/index.js';

let h;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());

describe('Event API', () => {
  test('participant cannot create an event (403); visitor gets 401', async () => {
    assert.equal((await h.api.post('/api/events').set(h.as('user')).send(h.eventBody())).status, 403);
    assert.equal((await h.api.post('/api/events').send(h.eventBody())).status, 401);
  });

  test('full lifecycle: create draft → submit → approve → public → archive', async () => {
    const c = await h.api.post('/api/events').set(h.as('orga')).send(h.eventBody({ title: 'Cycle de vie' }));
    assert.equal(c.status, 201);
    const id = c.body.event.id;
    assert.equal(c.body.event.status, 'draft');
    assert.equal((await h.api.get(`/api/events/${id}`)).status, 404, 'draft hidden from visitors');

    assert.equal((await h.api.post(`/api/events/${id}/submit`).set(h.as('orga'))).body.event.status, 'pending');
    assert.equal((await h.api.post(`/api/admin/events/${id}/approve`).set(h.as('orga'))).status, 403, 'organizer cannot approve');
    assert.equal((await h.api.post(`/api/admin/events/${id}/approve`).set(h.as('admin'))).body.event.status, 'published');

    const pub = await h.api.get(`/api/events/${id}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.event.venue.latitude, 36.8);

    assert.equal((await h.api.patch(`/api/events/${id}`).set(h.as('orga2')).send({ title: 'Volé' })).status, 403, 'other organizer');
    assert.equal((await h.api.patch(`/api/events/${id}`).set(h.as('orga')).send({ title: 'Cycle de vie (modifié)' })).body.event.title, 'Cycle de vie (modifié)');
    assert.equal((await h.api.post(`/api/events/${id}/archive`).set(h.as('orga'))).body.event.status, 'archived');
  });

  test('reject requires a reason and notifies the organizer', async () => {
    const c = await h.api.post('/api/events').set(h.as('orga')).send(h.eventBody({ title: 'À refuser' }));
    const id = c.body.event.id;
    await h.api.post(`/api/events/${id}/submit`).set(h.as('orga'));
    assert.equal((await h.api.post(`/api/admin/events/${id}/reject`).set(h.as('admin')).send({})).status, 400);
    const r = await h.api.post(`/api/admin/events/${id}/reject`).set(h.as('admin')).send({ reason: 'Accès PMR non précisé' });
    assert.equal(r.body.event.status, 'rejected');
    const notes = await h.api.get('/api/notifications').set(h.as('orga'));
    assert.ok(notes.body.items.some((n) => n.type === 'event_rejected'));
  });

  test('search, filters, sorting and pagination', async () => {
    await h.publishedEvent({ title: 'Concert gratuit signé', accessibility: { signLanguage: true }, price: 0 });
    await h.publishedEvent({ title: 'Exposition payante', accessibility: { wheelchair: true, audioDescription: true }, price: 15, venue: { name: 'Musée', address: 'x', city: 'Sousse' } });
    const all = await h.api.get('/api/events').query({ limit: 1 });
    assert.equal(all.status, 200);
    assert.equal(all.body.items.length, 1);
    assert.ok(all.body.pages >= 2);

    const text = await h.api.get('/api/events').query({ q: 'exposition' });
    assert.ok(text.body.items.every((e) => /Exposition/.test(e.title)));
    const free = await h.api.get('/api/events').query({ free: 'false' });
    assert.ok(free.body.items.every((e) => e.price > 0));
    const feat = await h.api.get('/api/events').query({ features: 'wheelchair,audioDescription' });
    assert.ok(feat.body.items.length >= 1 && feat.body.items.every((e) => e.accessibility.audioDescription));
    const city = await h.api.get('/api/events').query({ city: 'sousse' });
    assert.ok(city.body.items.every((e) => e.venue.city === 'Sousse'));
    const byPrice = await h.api.get('/api/events').query({ sort: '-price' });
    assert.ok(byPrice.body.items[0].price >= byPrice.body.items.at(-1).price);
    assert.equal((await h.api.get('/api/events').query({ features: 'nope' })).status, 400);
    assert.equal((await h.api.get('/api/events').query({ category: 'atelier' })).status, 200);
  });

  test('image upload validates type and converts to WebP', async () => {
    const id = await h.publishedEvent({ title: 'Avec image' });
    const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#123456' } }).png().toBuffer();
    const ok = await h.api.post(`/api/events/${id}/image`).set(h.as('orga')).field('alt', 'Affiche bleue').attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    assert.equal(ok.status, 200);
    assert.match(ok.body.event.coverImage.url, /^\/uploads\/.+\.webp$/);
    assert.equal(ok.body.event.coverImage.alt, 'Affiche bleue');
    assert.equal((await h.api.get(ok.body.event.coverImage.url)).status, 200);

    const fake = await h.api.post(`/api/events/${id}/image`).set(h.as('orga')).attach('image', Buffer.from('not an image at all'), { filename: 'x.png', contentType: 'image/png' });
    assert.equal(fake.status, 400);
    const exe = await h.api.post(`/api/events/${id}/image`).set(h.as('orga')).attach('image', Buffer.from('MZ'), { filename: 'x.exe', contentType: 'application/octet-stream' });
    assert.equal(exe.status, 400);
    const other = await h.api.post(`/api/events/${id}/image`).set(h.as('orga2')).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    assert.equal(other.status, 403);
  });

  test('map endpoint returns geolocated published events', async () => {
    const res = await h.api.get('/api/events/map');
    assert.equal(res.status, 200);
    assert.ok(res.body.items.every((e) => typeof e.venue.latitude === 'number'));
  });
});

describe('Booking API', () => {
  test('book, history, duplicate, cancel, calendar', async () => {
    const id = await h.publishedEvent({ title: 'Réservable', capacity: 5 });
    const b = await h.api.post('/api/bookings').set(h.as('user')).send({ eventId: id, seats: 2, accessibilityNeeds: ['wheelchair'] });
    assert.equal(b.status, 201);
    assert.equal(b.body.booking.availableSeats, 3);

    const dup = await h.api.post('/api/bookings').set(h.as('user')).send({ eventId: id, seats: 1 });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'ALREADY_BOOKED');

    const mine = await h.api.get('/api/bookings/me').set(h.as('user'));
    assert.ok(mine.body.items.some((x) => x._id === b.body.booking._id));

    const ics = await h.api.get('/api/bookings/me/calendar.ics').set(h.as('user'));
    assert.equal(ics.status, 200);
    assert.match(ics.headers['content-type'], /text\/calendar/);
    assert.match(ics.text, /SUMMARY:Réservable/);

    assert.equal((await h.api.post(`/api/bookings/${b.body.booking._id}/cancel`).set(h.as('user2'))).status, 403);
    const c = await h.api.post(`/api/bookings/${b.body.booking._id}/cancel`).set(h.as('user'));
    assert.equal(c.body.booking.status, 'cancelled');
    assert.equal((await Event.findById(id).lean()).availableSeats, 5);
    assert.equal((await h.api.post(`/api/bookings/${b.body.booking._id}/cancel`).set(h.as('user'))).status, 409);

    const notes = await h.api.get('/api/notifications').set(h.as('user'));
    const types = notes.body.items.map((n) => n.type);
    assert.ok(types.includes('booking_confirmed') && types.includes('booking_cancelled'));
    assert.ok(notes.body.items.every((n) => n.emailStatus !== 'sent'), 'dev mode never reports emails as sent');
  });

  test('full event → 409 NOT_ENOUGH_SEATS', async () => {
    const id = await h.publishedEvent({ title: 'Petit', capacity: 1 });
    assert.equal((await h.api.post('/api/bookings').set(h.as('user')).send({ eventId: id, seats: 1 })).status, 201);
    const full = await h.api.post('/api/bookings').set(h.as('user2')).send({ eventId: id, seats: 1 });
    assert.equal(full.status, 409);
    assert.equal(full.body.error.code, 'NOT_ENOUGH_SEATS');
  });

  test('concurrency: 25 parallel requests for 3 seats never overbook (real MongoDB)', async () => {
    const id = await h.publishedEvent({ title: 'Course aux places', capacity: 3 });
    const people = [];
    for (let i = 0; i < 25; i++) {
      const r = await h.api.post('/api/auth/register').send({ name: `P${i}`, email: `p${i}@race.tn`, password: 'Motdepasse1', acceptTerms: true });
      people.push(r.body.token);
    }
    const results = await Promise.all(people.map((t) => h.api.post('/api/bookings').set('Authorization', `Bearer ${t}`).send({ eventId: id, seats: 1 })));
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.equal(results.filter((r) => r.status === 409).length, 22);
    const ev = await Event.findById(id).lean();
    assert.equal(ev.availableSeats, 0);
    assert.equal(await Booking.countDocuments({ event: id, status: 'confirmed' }), 3);
  });

  test('concurrency: same user double-click → one booking (unique index)', async () => {
    const id = await h.publishedEvent({ title: 'Double clic', capacity: 10 });
    const rs = await Promise.all(Array.from({ length: 6 }, () => h.api.post('/api/bookings').set(h.as('user2')).send({ eventId: id, seats: 1 })));
    assert.equal(rs.filter((r) => r.status === 201).length, 1);
    assert.equal((await Event.findById(id).lean()).availableSeats, 9);
  });

  test('organizer reservations, check-in, statistics; admin statistics', async () => {
    const id = await h.publishedEvent({ title: 'Stats', capacity: 10 });
    const b = await h.api.post('/api/bookings').set(h.as('user')).send({ eventId: id, seats: 2 });
    assert.equal((await h.api.get(`/api/events/${id}/reservations`).set(h.as('orga2'))).status, 403);
    const list = await h.api.get(`/api/events/${id}/reservations`).set(h.as('orga'));
    assert.equal(list.body.summary.seatsBooked, 2);
    assert.equal((await h.api.patch(`/api/bookings/${b.body.booking._id}/check-in`).set(h.as('orga')).send({ checkedIn: true })).body.booking.checkedIn, true);

    const st = await h.api.get('/api/organizer/stats').set(h.as('orga'));
    assert.ok(st.body.stats.totalEvents >= 1);
    assert.ok(st.body.stats.events.find((e) => e.id === id).checkedIn === 2);
    assert.equal((await h.api.get('/api/organizer/stats').set(h.as('user'))).status, 403);

    const admin = await h.api.get('/api/admin/stats').set(h.as('admin'));
    assert.equal(admin.status, 200);
    assert.equal(admin.body.stats.totalEvents, await Event.countDocuments());
    assert.equal(admin.body.stats.totalReservations, await Booking.countDocuments({ status: 'confirmed' }));
    assert.equal((await h.api.get('/api/admin/stats').set(h.as('orga'))).status, 403);
  });

  test('reminders job creates one reminder per booking', async () => {
    const id = await h.publishedEvent({ title: 'Demain', startDate: new Date(Date.now() + 20 * 3600000).toISOString(), endDate: new Date(Date.now() + 22 * 3600000).toISOString() });
    await h.api.post('/api/bookings').set(h.as('user2')).send({ eventId: id, seats: 1 });
    const r1 = await h.api.post('/api/admin/reminders/run').set(h.as('admin'));
    const r2 = await h.api.post('/api/admin/reminders/run').set(h.as('admin'));
    assert.ok(r1.body.sent >= 1);
    assert.equal(r2.body.sent, 0);
  });
});

describe('Admin API', () => {
  test('user management and categories', async () => {
    const users = await h.api.get('/api/admin/users').set(h.as('admin')).query({ role: 'organizer' });
    assert.ok(users.body.items.every((u) => u.role === 'organizer'));
    assert.equal((await h.api.get('/api/admin/users').set(h.as('user'))).status, 403);
    assert.equal((await h.api.patch(`/api/admin/users/${h.users.admin._id}`).set(h.as('admin')).send({ role: 'user' })).status, 400, 'no self-demotion');
    const cat = await h.api.post('/api/categories').set(h.as('admin')).send({ name: 'Danse' });
    assert.equal(cat.status, 201);
    assert.equal(cat.body.category.slug, 'danse');
    assert.equal((await h.api.post('/api/categories').set(h.as('orga')).send({ name: 'X' })).status, 403);
    const s = await h.api.put('/api/admin/settings').set(h.as('admin')).send({ maxSeatsPerBooking: 2 });
    assert.equal(s.body.settings.maxSeatsPerBooking, 2);
    await h.api.put('/api/admin/settings').set(h.as('admin')).send({ maxSeatsPerBooking: 4 });
  });

  test('openapi is served', async () => {
    const res = await h.api.get('/api-docs.json');
    assert.equal(res.status, 200);
    assert.equal(res.body.info.title, 'InclusiVenue API');
    assert.equal((await h.api.get('/api/health')).body.db, 'connected');
  });

  test('contact form notifies admins', async () => {
    const r = await h.api.post('/api/contact').send({ name: 'Visiteur', email: 'v@t.tn', subject: 'Question', message: 'Est-ce accessible en fauteuil ?' });
    assert.equal(r.status, 201);
    const n = await h.api.get('/api/notifications').set(h.as('admin'));
    assert.ok(n.body.items.some((x) => x.type === 'contact_message'));
  });
});
