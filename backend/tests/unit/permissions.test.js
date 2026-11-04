import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../../src/utils/permissions.js';

const admin = { id: 'a', role: 'admin' };
const orga = { id: 'o1', role: 'organizer' };
const other = { id: 'o2', role: 'organizer' };
const user = { id: 'u', role: 'user' };
const ev = (status, organizer = 'o1') => ({ status, organizer });

describe('permissions', () => {
  test('only organizers and admins can create events', () => {
    assert.equal(p.canCreateEvent(orga), true);
    assert.equal(p.canCreateEvent(admin), true);
    assert.equal(p.canCreateEvent(user), false);
    assert.equal(p.canCreateEvent(null), false);
  });

  test('organizer manages only own events; admin manages all', () => {
    assert.equal(p.canManageEvent(orga, ev('draft')), true);
    assert.equal(p.canManageEvent(other, ev('draft')), false);
    assert.equal(p.canManageEvent(user, ev('draft', 'u')), false, 'a participant never manages events');
    assert.equal(p.canManageEvent(admin, ev('draft')), true);
    assert.equal(p.canManageEvent(orga, { status: 'draft', organizer: { _id: 'o1' } }), true, 'populated organizer');
  });

  test('drafts are hidden from the public', () => {
    assert.equal(p.canViewEvent(null, ev('published')), true);
    assert.equal(p.canViewEvent(null, ev('draft')), false);
    assert.equal(p.canViewEvent(user, ev('pending')), false);
    assert.equal(p.canViewEvent(other, ev('rejected')), false);
    assert.equal(p.canViewEvent(orga, ev('rejected')), true);
    assert.equal(p.canViewEvent(admin, ev('pending')), true);
  });

  test('only admin moderates', () => {
    assert.equal(p.canModerate(admin), true);
    assert.equal(p.canModerate(orga), false);
    assert.equal(p.canModerate(user), false);
  });

  test('delete rules: no confirmed bookings, organizer cannot delete published', () => {
    assert.equal(p.canDeleteEvent(orga, ev('draft'), 0), true);
    assert.equal(p.canDeleteEvent(orga, ev('published'), 0), false);
    assert.equal(p.canDeleteEvent(admin, ev('published'), 0), true);
    assert.equal(p.canDeleteEvent(admin, ev('published'), 3), false);
    assert.equal(p.canDeleteEvent(other, ev('draft'), 0), false);
  });

  test('status transitions', () => {
    assert.equal(p.canTransition(orga, ev('draft'), 'pending'), true);
    assert.equal(p.canTransition(orga, ev('draft'), 'published'), false, 'organizer cannot self-publish');
    assert.equal(p.canTransition(orga, ev('pending'), 'published'), false);
    assert.equal(p.canTransition(admin, ev('pending'), 'published'), true);
    assert.equal(p.canTransition(admin, ev('pending'), 'rejected'), true);
    assert.equal(p.canTransition(orga, ev('published'), 'archived'), true);
    assert.equal(p.canTransition(other, ev('published'), 'archived'), false);
    assert.equal(p.canTransition(orga, ev('archived'), 'draft'), false);
  });

  test('booking visibility', () => {
    const booking = { user: 'u' };
    assert.equal(p.canViewBooking(user, booking, ev('published')), true);
    assert.equal(p.canViewBooking({ id: 'x', role: 'user' }, booking, ev('published')), false);
    assert.equal(p.canViewBooking(orga, booking, ev('published')), true, 'event owner sees bookings');
    assert.equal(p.canViewBooking(other, booking, ev('published')), false);
    assert.equal(p.canViewBooking(admin, booking, null), true);
  });
});

test('self-publish only when moderation is disabled', () => {
  const o = { id: 'o1', role: 'organizer' };
  assert.equal(p.canTransition(o, { status: 'draft', organizer: 'o1' }, 'published'), false);
  assert.equal(p.canTransition(o, { status: 'draft', organizer: 'o1' }, 'published', { selfPublish: true }), true);
  assert.equal(p.canTransition(o, { status: 'archived', organizer: 'o1' }, 'published', { selfPublish: true }), false);
});
