import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../../src/validators/schemas.js';
import { zodToFields } from '../../src/middleware/common.js';

const validRegister = { name: 'Amira', email: 'Amira@Example.TN ', password: 'Motdepasse1', acceptTerms: true };

describe('auth validation', () => {
  test('normalises e-mail and defaults role to user', () => {
    const v = s.registerSchema.parse(validRegister);
    assert.equal(v.email, 'amira@example.tn');
    assert.equal(v.role, 'user');
  });

  test('administrator role cannot be self-assigned', () => {
    const r = s.registerSchema.safeParse({ ...validRegister, role: 'admin' });
    assert.equal(r.success, false);
    assert.ok(zodToFields(r.error).role);
  });

  test('unknown fields are rejected (mass assignment)', () => {
    const r = s.registerSchema.safeParse({ ...validRegister, status: 'active' });
    assert.equal(r.success, false);
  });

  test('organizer must give an organisation name', () => {
    const r = s.registerSchema.safeParse({ ...validRegister, role: 'organizer' });
    assert.equal(r.success, false);
    assert.match(zodToFields(r.error).organizationName, /association/);
  });

  test('password policy', () => {
    for (const pw of ['short1A', 'nouppercase1', 'NOLOWERCASE1', 'NoDigitsHere']) {
      assert.equal(s.registerSchema.safeParse({ ...validRegister, password: pw }).success, false, pw);
    }
  });

  test('terms must be accepted', () => {
    assert.equal(s.registerSchema.safeParse({ ...validRegister, acceptTerms: false }).success, false);
  });

  test('reset token must be 64 hex chars', () => {
    assert.equal(s.resetPasswordSchema.safeParse({ token: 'abc', password: 'Motdepasse1' }).success, false);
    assert.equal(s.resetPasswordSchema.safeParse({ token: 'a'.repeat(64), password: 'Motdepasse1' }).success, true);
  });
});

describe('event validation', () => {
  const base = {
    title: 'Concert',
    description: 'Une description assez longue pour être valide.',
    category: 'a'.repeat(24),
    startDate: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 90000000).toISOString(),
    venue: { name: 'Salle', address: '1 rue', city: 'Tunis' },
    capacity: 10,
  };

  test('valid event with defaults', () => {
    const v = s.createEventSchema.parse(base);
    assert.equal(v.price, 0);
    assert.ok(v.startDate instanceof Date);
  });

  test('end date must follow start date', () => {
    const r = s.createEventSchema.safeParse({ ...base, endDate: base.startDate });
    assert.equal(r.success, false);
    assert.ok(zodToFields(r.error).endDate);
  });

  test('start date must be in the future on creation', () => {
    const r = s.createEventSchema.safeParse({ ...base, startDate: '2020-01-01T10:00:00Z', endDate: '2020-01-01T12:00:00Z' });
    assert.equal(r.success, false);
  });

  test('capacity must be a positive integer, price non negative', () => {
    assert.equal(s.createEventSchema.safeParse({ ...base, capacity: 0 }).success, false);
    assert.equal(s.createEventSchema.safeParse({ ...base, capacity: 2.5 }).success, false);
    assert.equal(s.createEventSchema.safeParse({ ...base, price: -1 }).success, false);
  });

  test('unknown accessibility feature rejected; status cannot be injected', () => {
    assert.equal(s.createEventSchema.safeParse({ ...base, accessibility: { teleport: true } }).success, false);
    assert.equal(s.createEventSchema.safeParse({ ...base, status: 'published' }).success, false);
    assert.equal(s.updateEventSchema.safeParse({ availableSeats: 999 }).success, false);
  });

  test('search query parses features list and defaults', () => {
    const q = s.eventQuerySchema.parse({ features: 'wheelchair,signLanguage', page: '2' });
    assert.deepEqual(q.features, ['wheelchair', 'signLanguage']);
    assert.equal(q.page, 2);
    assert.equal(q.limit, 12);
    assert.equal(q.sort, 'date');
    assert.equal(s.eventQuerySchema.safeParse({ features: 'wheelchair,bogus' }).success, false);
    assert.equal(s.eventQuerySchema.safeParse({ limit: '500' }).success, false);
  });
});

describe('booking & preference validation', () => {
  test('seats bounds', () => {
    assert.equal(s.createBookingSchema.safeParse({ eventId: 'a'.repeat(24), seats: 0 }).success, false);
    assert.equal(s.createBookingSchema.safeParse({ eventId: 'a'.repeat(24), seats: 2 }).success, true);
    assert.equal(s.createBookingSchema.safeParse({ eventId: 'not-an-id', seats: 1 }).success, false);
  });

  test('preferences accept only known values', () => {
    assert.equal(s.preferencesSchema.safeParse({ fontScale: 150, highContrast: true }).success, true);
    assert.equal(s.preferencesSchema.safeParse({ fontScale: 300 }).success, false);
    assert.equal(s.preferencesSchema.safeParse({ preferredFeatures: ['wheelchair', 'x'] }).success, false);
    assert.equal(s.preferencesSchema.safeParse({ role: 'admin' }).success, false);
  });

  test('contact form', () => {
    assert.equal(s.contactSchema.safeParse({ name: 'A', email: 'a@b.tn', subject: 'Hi', message: 'court' }).success, false);
    assert.equal(s.contactSchema.safeParse({ name: 'Ali', email: 'a@b.tn', subject: 'Question', message: 'Bonjour, une question.' }).success, true);
  });
});
