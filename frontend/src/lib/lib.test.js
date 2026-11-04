import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, fromLocalInput, toLocalInput, seatsLabel, plural, ACCESSIBILITY_FEATURES } from './format.js';
import { registerSchema, eventFormSchema, contactSchema } from './validation.js';

test('price and seats labels', () => {
  assert.equal(formatPrice(0), 'Gratuit');
  assert.match(formatPrice(15), /15\sTND/);
  assert.equal(seatsLabel({ availableSeats: 0 }), 'Complet');
  assert.equal(seatsLabel({ availableSeats: 3 }), 'Plus que 3 places');
  assert.equal(plural(1, 'place', 'places'), '1 place');
});

test('datetime-local conversion uses Tunis time (UTC+1) both ways', () => {
  const iso = fromLocalInput('2030-05-10T15:00');
  assert.equal(iso, '2030-05-10T14:00:00.000Z');
  assert.equal(toLocalInput(iso), '2030-05-10T15:00');
});

test('12 accessibility features with unique keys', () => {
  assert.equal(new Set(ACCESSIBILITY_FEATURES.map((f) => f.key)).size, 12);
});

test('register form: password confirmation and organisation name', () => {
  const base = { name: 'Ali', email: 'ali@x.tn', password: 'Secret123', confirm: 'Secret123', role: 'user', acceptTerms: true };
  assert.equal(registerSchema.safeParse(base).success, true);
  assert.equal(registerSchema.safeParse({ ...base, confirm: 'x' }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, role: 'organizer' }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, role: 'admin' }).success, false);
});

test('event form: end after start, lat/lng both or none', () => {
  const base = { title: 'Titre', description: 'x'.repeat(25), category: 'c', startDate: '2030-01-01T10:00', endDate: '2030-01-01T12:00', venueName: 'Lieu', address: 'Rue 1', city: 'Tunis', price: '0', capacity: '10' };
  assert.equal(eventFormSchema.safeParse(base).success, true);
  assert.equal(eventFormSchema.safeParse({ ...base, endDate: '2030-01-01T09:00' }).success, false);
  assert.equal(eventFormSchema.safeParse({ ...base, latitude: 36.8 }).success, false);
  assert.equal(eventFormSchema.safeParse({ ...base, latitude: 36.8, longitude: 10.1 }).success, true);
  assert.equal(eventFormSchema.safeParse({ ...base, capacity: '0' }).success, false);
});

test('contact form', () => {
  assert.equal(contactSchema.safeParse({ name: 'A', email: 'bad', subject: 'x', message: 'court' }).success, false);
});
