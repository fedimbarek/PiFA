import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCalendar, escapeText, foldLine, toICalDate } from '../../src/utils/ical.js';
import { paginate, pageResult, escapeRegex } from '../../src/utils/pagination.js';
import { createMailService } from '../../src/services/mail.service.js';
import { createStatsService, rate } from '../../src/services/stats.service.js';
import { mergePreferences } from '../../src/services/user.service.js';
import { createSettingsService, slugify } from '../../src/services/platform.service.js';
import { openapi } from '../../src/docs/openapi.js';
import { setup } from '../helpers/setup.js';

describe('iCalendar', () => {
  test('dates in UTC basic format', () => {
    assert.equal(toICalDate('2030-03-05T08:04:09.123Z'), '20300305T080409Z');
  });
  test('escapes special characters', () => {
    assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  });
  test('folds long lines at 75 octets without splitting characters', () => {
    const line = `DESCRIPTION:${'é'.repeat(80)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) assert.ok(Buffer.byteLength(part) <= 75);
    assert.equal(folded.replace(/\r\n /g, ''), line);
  });
  test('builds a valid calendar with alarm', () => {
    const ics = buildCalendar([{ uid: '1@iv', start: new Date('2030-01-01T10:00:00Z'), end: new Date('2030-01-01T12:00:00Z'), title: 'Expo', location: 'Tunis' }], { now: new Date('2029-12-01T00:00:00Z') });
    assert.match(ics, /BEGIN:VEVENT\r\nUID:1@iv\r\nDTSTAMP:20291201T000000Z\r\nDTSTART:20300101T100000Z/);
    assert.match(ics, /TRIGGER:-PT24H/);
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  });
});

describe('pagination', () => {
  test('bounds page and limit', () => {
    assert.deepEqual(paginate({ page: '0', limit: '999' }), { page: 1, limit: 50, skip: 0 });
    assert.deepEqual(paginate({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
    assert.equal(pageResult([], 21, { page: 1, limit: 10 }).pages, 3);
    assert.equal(escapeRegex('a.b*'), 'a\\.b\\*');
  });
});

describe('mail service', () => {
  test('log mode stores the email as "logged" and never claims it was sent', async () => {
    const logs = [];
    const m = createMailService({ mode: 'log', emailLogRepo: { create: async (d) => logs.push(d) }, logger: { info() {} } });
    assert.equal(await m.send({ to: 'a@b.tn', subject: 's', text: 't' }), 'logged');
    assert.equal(logs[0].status, 'logged');
    assert.equal(m.mode, 'log');
  });
  test('smtp mode reports failures', async () => {
    const logs = [];
    const transport = { sendMail: async () => { throw new Error('ECONNREFUSED'); } };
    const m = createMailService({ mode: 'smtp', transport, emailLogRepo: { create: async (d) => logs.push(d) }, logger: { error() {} } });
    assert.equal(await m.send({ to: 'a@b.tn', subject: 's', text: 't' }), 'failed');
    assert.equal(logs[0].error, 'ECONNREFUSED');
  });
  test('smtp mode sends through the transport', async () => {
    const sent = [];
    const m = createMailService({ mode: 'smtp', from: 'x', transport: { sendMail: async (o) => sent.push(o) }, emailLogRepo: { create: async () => {} } });
    assert.equal(await m.send({ to: 'a@b.tn', subject: 's', text: 't' }), 'sent');
    assert.equal(sent[0].to, 'a@b.tn');
  });
});

describe('notifications', () => {
  test('respects the user email preference and supports read state', async () => {
    const ctx = setup();
    const { users } = await ctx.fixtures();
    ctx.f.db.users.get(users.user.id).preferences.emailNotifications = false;
    const n = await ctx.services.notifications.notify(users.user.id, { type: 'system', title: 'T', message: 'M' });
    assert.equal(n.emailStatus, 'disabled');
    assert.equal(ctx.f.db.emails.length, 0);
    const list = await ctx.services.notifications.list(users.user.id);
    assert.equal(list.unread, 1);
    await ctx.services.notifications.markRead(users.user.id, n._id);
    assert.equal(await ctx.services.notifications.unreadCount(users.user.id), 0);
    await assert.rejects(() => ctx.services.notifications.markRead(users.user2.id, n._id), { status: 404 }, 'cannot read others');
  });
});

describe('accessibility preferences', () => {
  test('merge keeps existing values and de-duplicates features', () => {
    const m = mergePreferences({ fontScale: 125, highContrast: true, preferredFeatures: ['wheelchair'] }, { highContrast: false, preferredFeatures: ['signLanguage', 'signLanguage'] });
    assert.deepEqual(m, { fontScale: 125, highContrast: false, preferredFeatures: ['signLanguage'] });
  });
  test('persist through the user service', async () => {
    const ctx = setup();
    const { users } = await ctx.fixtures();
    const p = await ctx.services.users.updatePreferences(users.user.id, { fontScale: 150, reducedMotion: true });
    assert.equal(p.fontScale, 150);
    assert.equal((await ctx.services.users.getProfile(users.user.id)).preferences.reducedMotion, true);
  });
  test('admin cannot change own role; organisation name ignored for participants', async () => {
    const ctx = setup();
    const { users } = await ctx.fixtures();
    await assert.rejects(() => ctx.services.users.adminUpdate(users.admin, users.admin.id, { role: 'user' }), { status: 400 });
    const updated = await ctx.services.users.adminUpdate(users.admin, users.user.id, { status: 'suspended' });
    assert.equal(updated.status, 'suspended');
    const prof = await ctx.services.users.updateProfile(users.user2, { city: 'Sfax', organizationName: 'X' });
    assert.equal(prof.organizationName, '');
  });
});

describe('platform', () => {
  test('slugify', () => {
    assert.equal(slugify('Activité communautaire'), 'activite-communautaire');
  });
  test('settings cache', async () => {
    let calls = 0;
    const s = createSettingsService({ settingRepo: { get: async () => ({ n: ++calls }), update: async (d) => d }, ttlMs: 1000, clock: () => 0 });
    await s.get();
    await s.get();
    assert.equal(calls, 1);
  });
  test('category delete refused when used', async () => {
    const ctx = setup();
    const { users, cat } = await ctx.fixtures();
    await ctx.services.events.create(users.orga, ctx.eventInput(cat));
    await assert.rejects(() => ctx.services.categories.remove(cat._id), { status: 400 });
    await assert.rejects(() => ctx.services.categories.create({ name: 'Atelier' }), { status: 409 });
  });
});

describe('statistics', () => {
  test('rates and organizer dashboard computed from repository data', async () => {
    assert.equal(rate(1, 3), 33.3);
    assert.equal(rate(1, 0), 0);
    const stats = createStatsService({
      statsRepo: {
        organizerOverview: async () => ({ totalEvents: 3, published: 2, upcoming: 1, capacity: 100, availableSeats: 25, reservations: 30, seatsBooked: 75, checkedIn: 60 }),
        organizerPerEvent: async () => [{ _id: 'e1', title: 'A', capacity: 50, seatsBooked: 40, checkedIn: 20 }],
      },
    });
    const o = await stats.organizer('o');
    assert.equal(o.occupancyRate, 75);
    assert.equal(o.attendanceRate, 80);
    assert.equal(o.events[0].occupancyRate, 80);
    assert.equal(o.draftEvents, 0);
  });
});

describe('OpenAPI documentation', () => {
  test('every route declared in routes/index.js is documented', () => {
    const src = fs.readFileSync(new URL('../../src/routes/index.js', import.meta.url), 'utf8');
    const routes = [...src.matchAll(/r\.(get|post|put|patch|delete)\('([^']+)'/g)].map(([, m, p]) => [m, `/api${p.replace(/:(\w+)/g, '{$1}')}`]);
    assert.ok(routes.length > 40);
    const missing = routes.filter(([m, p]) => !openapi.paths[p]?.[m]);
    assert.deepEqual(missing, []);
  });
});
