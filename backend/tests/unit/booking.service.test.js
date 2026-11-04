import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../helpers/setup.js';
import { futureDate } from '../helpers/fakes.js';
import { cancellationAllowed } from '../../src/services/booking.service.js';

let ctx;
let u;
let cat;
beforeEach(async () => {
  ctx = setup();
  ({ users: u, cat } = await ctx.fixtures());
});

const seatsLeft = (id) => ctx.f.db.events.get(id).availableSeats;

describe('booking service — creation', () => {
  test('books seats, decrements availability and notifies participant and organizer', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 5 });
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 2, accessibilityNeeds: ['wheelchair'] });
    assert.equal(b.status, 'confirmed');
    assert.match(b.reference, /^IV-[0-9A-F]{8}$/);
    assert.equal(seatsLeft(e.id), 3);
    const types = ctx.f.db.notifications.map((n) => `${n.type}:${n.user}`);
    assert.ok(types.includes(`booking_confirmed:${u.user.id}`));
    assert.ok(types.includes(`new_booking:${u.orga.id}`));
    const confirmation = ctx.f.db.notifications.find((n) => n.type === 'booking_confirmed');
    assert.match(confirmation.message, /Accès fauteuil roulant/);
    assert.equal(confirmation.emailStatus, 'logged', 'dev mode email is logged, not claimed as sent');
  });

  test('refuses a duplicate booking for the same event', async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    await assert.rejects(() => ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 }), { status: 409, code: 'ALREADY_BOOKED' });
    assert.equal(seatsLeft(e.id), 2);
  });

  test('concurrent duplicate requests from one user: one succeeds, seats compensated', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 10 });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 })));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(seatsLeft(e.id), 9, 'no seat leaked by rejected duplicates');
  });

  test('refuses when the event is full or not enough seats remain', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 2 });
    await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 2 });
    const err = await ctx.services.bookings.create(u.user2, { eventId: e.id, seats: 1 }).catch((x) => x);
    assert.equal(err.code, 'NOT_ENOUGH_SEATS');
    assert.match(err.message, /complet/);
  });

  test('last seat race: 20 users, 1 seat → exactly one booking', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 1 });
    const people = await Promise.all(Array.from({ length: 20 }, (_, i) => ctx.makeUser('user', `p${i}`)));
    const results = await Promise.allSettled(people.map((p) => ctx.services.bookings.create(p, { eventId: e.id, seats: 1 })));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.reason?.code === 'NOT_ENOUGH_SEATS').length, 19);
    assert.equal(seatsLeft(e.id), 0);
  });

  test('respects the max seats per booking setting', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 50 });
    await assert.rejects(() => ctx.services.bookings.create(u.user, { eventId: e.id, seats: 5 }), { status: 400 });
  });

  test('cannot book drafts, pending or past events', async () => {
    const draft = await ctx.services.events.create(u.orga, ctx.eventInput(cat));
    await assert.rejects(() => ctx.services.bookings.create(u.user, { eventId: draft.id, seats: 1 }), { status: 404 });
    const past = await ctx.publishedEvent(u.orga, cat);
    ctx.f.db.events.get(past.id).startDate = new Date(Date.now() - 3600000);
    await assert.rejects(() => ctx.services.bookings.create(u.user, { eventId: past.id, seats: 1 }), { status: 400 });
  });
});

describe('booking service — cancellation', () => {
  test('participant cancels and seats are released', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 3 });
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 2 });
    const c = await ctx.services.bookings.cancel(u.user, b._id);
    assert.equal(c.status, 'cancelled');
    assert.equal(c.cancelledBy, 'user');
    assert.equal(seatsLeft(e.id), 3);
    assert.ok(ctx.f.db.notifications.some((n) => n.type === 'booking_cancelled' && n.user === u.user.id));
  });

  test('cancelling twice is refused and does not release seats twice', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { capacity: 3 });
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    await ctx.services.bookings.cancel(u.user, b._id);
    await assert.rejects(() => ctx.services.bookings.cancel(u.user, b._id), { status: 409 });
    assert.equal(seatsLeft(e.id), 3);
  });

  test("another participant cannot cancel someone else's booking", async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    await assert.rejects(() => ctx.services.bookings.cancel(u.user2, b._id), { status: 403 });
    await assert.rejects(() => ctx.services.bookings.cancel(u.orga2, b._id), { status: 403 }, 'other organizer');
  });

  test('event owner and admin can cancel a booking', async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    const b1 = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    const b2 = await ctx.services.bookings.create(u.user2, { eventId: e.id, seats: 1 });
    assert.equal((await ctx.services.bookings.cancel(u.orga, b1._id)).cancelledBy, 'organizer');
    assert.equal((await ctx.services.bookings.cancel(u.admin, b2._id)).cancelledBy, 'admin');
  });

  test('participant cannot cancel after the deadline', async () => {
    const e = await ctx.publishedEvent(u.orga, cat, { startDate: futureDate(0, 1), endDate: futureDate(0, 3) });
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    await assert.rejects(() => ctx.services.bookings.cancel(u.user, b._id), /moins de 2 h/);
  });

  test('cancellationAllowed helper', () => {
    const now = new Date('2030-01-01T10:00:00Z');
    assert.equal(cancellationAllowed({ startDate: '2030-01-01T13:00:00Z' }, now, 2), true);
    assert.equal(cancellationAllowed({ startDate: '2030-01-01T11:00:00Z' }, now, 2), false);
    assert.equal(cancellationAllowed(null, now, 2), false);
  });
});

describe('booking service — history, check-in, calendar, reminders', () => {
  test('history lists only my bookings; booking detail is private', async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    await ctx.services.bookings.create(u.user2, { eventId: e.id, seats: 1 });
    const mine = await ctx.services.bookings.listMine(u.user);
    assert.equal(mine.total, 1);
    await assert.rejects(() => ctx.services.bookings.getById(u.user2, b._id), { status: 404 });
    assert.ok(await ctx.services.bookings.getById(u.orga, b._id), 'owner organizer can view');
  });

  test('only the event organizer can check in attendees', async () => {
    const e = await ctx.publishedEvent(u.orga, cat);
    const b = await ctx.services.bookings.create(u.user, { eventId: e.id, seats: 1 });
    await assert.rejects(() => ctx.services.bookings.checkIn(u.orga2, b._id, true), { status: 403 });
    const ok = await ctx.services.bookings.checkIn(u.orga, b._id, true);
    assert.equal(ok.checkedIn, true);
  });

  test('iCal export contains confirmed bookings only', async () => {
    const e1 = await ctx.publishedEvent(u.orga, cat, { title: 'Concert, plein air; soirée' });
    const e2 = await ctx.publishedEvent(u.orga, cat, { title: 'Autre' });
    await ctx.services.bookings.create(u.user, { eventId: e1.id, seats: 1 });
    const b2 = await ctx.services.bookings.create(u.user, { eventId: e2.id, seats: 1 });
    await ctx.services.bookings.cancel(u.user, b2._id);
    const ics = await ctx.services.bookings.calendarForUser(u.user);
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
    assert.match(ics, /SUMMARY:Concert\\, plein air\\; soirée/);
  });

  test('reminders are sent once for events in the next 24h', async () => {
    const soon = await ctx.publishedEvent(u.orga, cat, { startDate: futureDate(0, 20), endDate: futureDate(0, 22) });
    const later = await ctx.publishedEvent(u.orga, cat, { startDate: futureDate(5), endDate: futureDate(5, 2) });
    await ctx.services.bookings.create(u.user, { eventId: soon.id, seats: 1 });
    await ctx.services.bookings.create(u.user, { eventId: later.id, seats: 1 });
    const r1 = await ctx.services.bookings.sendReminders(24);
    const r2 = await ctx.services.bookings.sendReminders(24);
    assert.equal(r1.sent, 1);
    assert.equal(r2.sent, 0, 'idempotent');
    assert.equal(ctx.f.db.notifications.filter((n) => n.type === 'event_reminder').length, 1);
  });
});
