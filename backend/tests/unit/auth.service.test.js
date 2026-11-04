import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../helpers/setup.js';
import { fakeTokens } from '../helpers/fakes.js';
import { hashToken, toPublicUser } from '../../src/services/auth.service.js';

let ctx;
beforeEach(() => {
  ctx = setup();
});

describe('auth service', () => {
  test('register creates a participant with a hashed password and a token', async () => {
    const { user, token } = await ctx.services.auth.register({ name: 'Amira', email: 'amira@test.tn', password: 'Secret123' });
    assert.equal(user.role, 'user');
    assert.equal(user.passwordHash, undefined, 'hash is never returned');
    const stored = [...ctx.f.db.users.values()][0];
    assert.notEqual(stored.passwordHash, 'Secret123');
    assert.equal(fakeTokens.verify(token).sub, user.id);
  });

  test('register refuses the admin role even if validation was bypassed', async () => {
    await assert.rejects(() => ctx.services.auth.register({ name: 'X', email: 'x@test.tn', password: 'Secret123', role: 'admin' }), { status: 403 });
  });

  test('register refuses duplicate e-mails', async () => {
    await ctx.services.auth.register({ name: 'A', email: 'dup@test.tn', password: 'Secret123' });
    await assert.rejects(() => ctx.services.auth.register({ name: 'B', email: 'DUP@test.tn', password: 'Secret123' }), { status: 409, code: 'EMAIL_TAKEN' });
  });

  test('organizer signup can be closed by settings', async () => {
    ctx.f.db.settings.allowOrganizerSignup = false;
    await assert.rejects(
      () => ctx.services.auth.register({ name: 'O', email: 'o@test.tn', password: 'Secret123', role: 'organizer', organizationName: 'Asso' }),
      { status: 403 },
    );
  });

  test('login succeeds with the right password, fails with a generic message otherwise', async () => {
    await ctx.services.auth.register({ name: 'A', email: 'a@test.tn', password: 'Secret123' });
    const ok = await ctx.services.auth.login({ email: 'a@test.tn', password: 'Secret123' });
    assert.ok(ok.token);
    const wrong = await ctx.services.auth.login({ email: 'a@test.tn', password: 'nope' }).catch((e) => e);
    const unknown = await ctx.services.auth.login({ email: 'zz@test.tn', password: 'nope' }).catch((e) => e);
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.message, unknown.message, 'no account enumeration');
  });

  test('suspended accounts cannot log in', async () => {
    const { user } = await ctx.services.auth.register({ name: 'A', email: 's@test.tn', password: 'Secret123' });
    ctx.f.db.users.get(user.id).status = 'suspended';
    await assert.rejects(() => ctx.services.auth.login({ email: 's@test.tn', password: 'Secret123' }), { status: 403, code: 'ACCOUNT_SUSPENDED' });
  });

  test('forgot/reset password: token stored hashed, single use, expires', async () => {
    let now = new Date('2030-01-01T10:00:00Z');
    ctx = setup({ clock: () => now });
    await ctx.services.auth.register({ name: 'A', email: 'r@test.tn', password: 'Secret123' });
    const res = await ctx.services.auth.forgotPassword({ email: 'r@test.tn' });
    assert.match(res.message, /Si un compte/);
    const mail = ctx.f.db.emails.at(-1);
    assert.equal(mail.status, 'logged', 'dev mode: logged, not sent');
    const token = mail.text.match(/token=([a-f0-9]{64})/)[1];
    const stored = [...ctx.f.db.users.values()][0];
    assert.equal(stored.passwordReset.tokenHash, hashToken(token));
    assert.notEqual(stored.passwordReset.tokenHash, token);

    await ctx.services.auth.resetPassword({ token, password: 'NewSecret1' });
    await ctx.services.auth.login({ email: 'r@test.tn', password: 'NewSecret1' });
    await assert.rejects(() => ctx.services.auth.resetPassword({ token, password: 'Again12345' }), { status: 400 }, 'single use');

    await ctx.services.auth.forgotPassword({ email: 'r@test.tn' });
    const token2 = ctx.f.db.emails.at(-1).text.match(/token=([a-f0-9]{64})/)[1];
    now = new Date('2030-01-01T11:30:00Z');
    await assert.rejects(() => ctx.services.auth.resetPassword({ token: token2, password: 'Again12345' }), { status: 400 }, 'expired after 1h');
  });

  test('forgot password for unknown e-mail sends nothing but answers the same', async () => {
    const res = await ctx.services.auth.forgotPassword({ email: 'nobody@test.tn' });
    assert.match(res.message, /Si un compte/);
    assert.equal(ctx.f.db.emails.length, 0);
  });

  test('change password requires the current password', async () => {
    const { user } = await ctx.services.auth.register({ name: 'A', email: 'c@test.tn', password: 'Secret123' });
    await assert.rejects(() => ctx.services.auth.changePassword(user.id, { currentPassword: 'bad', newPassword: 'Other1234' }), { status: 400 });
    await ctx.services.auth.changePassword(user.id, { currentPassword: 'Secret123', newPassword: 'Other1234' });
    assert.ok(ctx.f.db.users.get(user.id).passwordChangedAt);
  });

  test('toPublicUser strips secrets', () => {
    const pub = toPublicUser({ _id: '1', name: 'n', email: 'e', role: 'user', passwordHash: 'h', passwordReset: { tokenHash: 't' } });
    assert.equal(pub.passwordHash, undefined);
    assert.equal(pub.passwordReset, undefined);
    assert.equal(pub.id, '1');
  });
});
