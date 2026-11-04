import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../helpers/setup.js';
import { buildEventFilter, buildEventSort, toEventDocument, serializeEvent } from '../../src/services/event.service.js';

let ctx;
let u;
let cat;
beforeEach(async () => {
  ctx = setup();
  ({ users: u, cat } = await ctx.fixtures());
});

describe('search helpers', () => {
  const now = new Date('2030-01-01T00:00:00Z');

  test('default filter: published and not finished', () => {
    assert.deepEqual(buildEventFilter({}, now), { status: 'published', endDate: { $gte: now } });
  });

  test('combines text, city, dates, price and accessibility filters', () => {
    const f = buildEventFilter(
      { q: 'concert', city: 'Tunis', from: new Date('2030-02-01'), to: new Date('2030-02-10'), free: 'true', features: ['wheelchair', 'signLanguage'], available: 'true', categoryId: 'c1' },
      now,
    );
    assert.deepEqual(f.$text, { $search: 'concert' });
    assert.ok(f['venue.city'].test('tunis'));
    assert.ok(!f['venue.city'].test('tunis-nord'), 'exact city match');
    assert.equal(f.startDate.$gte.toISOString(), '2030-02-01T00:00:00.000Z');
    assert.equal(f.startDate.$lte.toISOString(), '2030-02-10T23:59:59.999Z', 'end of day inclusive');
    assert.equal(f.isFree, true);
    assert.equal(f['accessibility.wheelchair'], true);
    assert.equal(f['accessibility.signLanguage'], true);
    assert.deepEqual(f.availableSeats, { $gt: 0 });
    assert.equal(f.category, 'c1');
  });

  test('city input is regex-escaped', () => {
    const f = buildEventFilter({ city: '.*' }, now);
    assert.equal(f['venue.city'].test('Sfax'), false);
  });

  test('sorting', () => {
    assert.deepEqual(buildEventSort('date'), { startDate: 1 });
    assert.deepEqual(buildEventSort('-price'), { price: -1, startDate: 1 });
    assert.deepEqual(buildEventSort('relevance', true), { score: { $meta: 'textScore' }, startDate: 1 });
    assert.deepEqual(buildEventSort('relevance', false), { startDate: 1 });
  });

  test('toEventDocument converts lat/lng to GeoJSON and derives isFree', () => {
    const d = toEventDocument({ venue: { name: 'a', address: 'b', city: 'c', latitude: 36.8, longitude: 10.1 }, price: 15, accessibility: { wheelchair: true } });
    assert.deepEqual(d.venue.location, { type: 'Point', coordinates: [10.1, 36.8] });
    assert.equal(d.isFree, false);
    assert.equal(d.accessibility.wheelchair, true);
    assert.equal(d.accessibility.signLanguage, false);
  });

  test('serializeEvent exposes occupancy and lat/lng', () => {
    const s = serializeEvent({ _id: 'x', capacity: 40, availableSeats: 10, venue: { name: 'v', location: { coordinates: [10, 36] } }, accessibility: { wheelchair: true } });
    assert.equal(s.bookedSeats, 30);
    assert.equal(s.occupancyRate, 75);
    assert.equal(s.venue.latitude, 36);
    assert.deepEqual(s.accessibilityFeatures, ['wheelchair']);
  });
});

describe('event lifecycle', () => {
  test('participants cannot create events', async () => {
    await assert.rejects(() => ctx.services.events.create(u.user, ctx.eventInput(cat)), { status: 403 });
  });

  test('created events are drafts with all seats available', async () => {
    const e = await ctx.services.events.create(u.orga, ctx.eventInput(cat, { capacity: 30 }));
    assert.equal(e.status, 'draft');
    assert.equal(e.availableSeats, 30);
    assert.equal(e.organizer, u.orga.id);
  });

  test('unknown or inactive category is refused', async () => {
    await assert.rejects(() => ctx.services.events.create(u.orga, ctx.eventInput({ _id: 'nope' })), { status: 400 });
  });

  test('drafts are invisible to the public and to other organizers', async () => {
    const e = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    await assert.rejects(() => ctx.services.events.getById(null, e.id), { status: 404 });
    await assert.rejects(() => ctx.services.events.getById(u.orga2, e.id), { status: 404 });
    assert.ok(await ctx.services.events.getById(u.orga, e.id));
  });

  test('only owner or admin can update', async () => {
    const e = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    await assert.rejects(() => ctx.services.events.update(u.orga2, e.id, { title: 'Pirate' }), { status: 403 });
    const ok = await ctx.services.events.update(u.admin, e.id, { title: 'Titre admin' });
    assert.equal(ok.title, 'Titre admin');
  });

  test('capacity cannot go below booked seats; otherwise availability is recomputed', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 4 });
    await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 3 });
    await assert.rejects(() => ctx.services.events.update(u.orga, e.id, { capacity: 2 }), { code: 'CAPACITY_BELOW_BOOKED' });
    const bigger = await ctx.services.events.update(u.orga, e.id, { capacity: 10 });
    assert.equal(bigger.capacity, 10);
    assert.equal(bigger.availableSeats, 7);
  });

  test('submit goes to moderation and notifies admins', async () => {
    const e = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    const s = await ctx.services.events.submit(u.orga, e.id);
    assert.equal(s.status, 'pending');
    assert.ok(ctx.f.db.notifications.some((n) => n.type === 'event_submitted' && n.user === u.admin.id));
  });

  test('submit publishes directly when moderation is disabled', async () => {
    ctx.f.db.settings.requireModeration = false;
    const e = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    assert.equal((await ctx.services.events.submit(u.orga, e.id)).status, 'published');
  });

  test('admin approves or rejects with reason; organizer is notified', async () => {
    const e1 = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    const e2 = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    await ctx.services.events.submit(u.orga, e1.id);
    await ctx.services.events.submit(u.orga, e2.id);
    await assert.rejects(() => ctx.services.events.approve(u.orga, e1.id), { status: 403 });
    assert.equal((await ctx.services.events.approve(u.admin, e1.id)).status, 'published');
    const r = await ctx.services.events.reject(u.admin, e2.id, 'Informations PMR manquantes');
    assert.equal(r.status, 'rejected');
    assert.equal(r.moderation.reason, 'Informations PMR manquantes');
    const types = ctx.f.db.notifications.filter((n) => n.user === u.orga.id).map((n) => n.type);
    assert.ok(types.includes('event_approved') && types.includes('event_rejected'));
  });

  test('approving a draft directly is not a valid transition for the organizer', async () => {
    const e = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    await assert.rejects(() => ctx.services.events.unsubmit(u.orga, e.id), { status: 400 }, 'draft → draft');
  });

  test('archiving a future event cancels bookings and frees seats', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 5 });
    await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 2 });
    const a = await ctx.services.events.archive(u.orga, e.id);
    assert.equal(a.status, 'archived');
    assert.equal(a.cancelledBookings, 1);
    assert.equal(ctx.f.db.events.get(e.id).availableSeats, 5);
    assert.ok(ctx.f.db.notifications.some((n) => n.type === 'event_cancelled' && n.user === u.user.id));
  });

  test('delete: allowed for drafts, refused for published or booked events', async () => {
    const d = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    await ctx.services.events.remove(u.orga, d.id);
    assert.equal(ctx.f.db.events.has(d.id), false);
    const p = await ctx.publishedEvent(u.orga, cat);
    await assert.rejects(() => ctx.services.events.remove(u.orga, p.id), { status: 400 });
    await ctx.services.bookings.create(u.user, { eventId: p.id, seats: 1 });
    await assert.rejects(() => ctx.services.events.remove(u.admin, p.id), /archivez/);
  });

  test('reservations of an event are visible only to its organizer and admins', async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 2 });
    await assert.rejects(() => ctx.services.events.reservationsForEvent(u.orga2, e.id), { status: 403 });
    const r = await ctx.services.events.reservationsForEvent(u.orga, e.id);
    assert.equal(r.summary.seatsBooked, 2);
  });

  test('event detail exposes my booking to the logged-in participant', async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 2 });
    assert.equal((await ctx.services.events.getById(u.user, e.id)).myBooking.seats, 2);
    assert.equal((await ctx.services.events.getById(u.user2, e.id)).myBooking, null);
  });
});
