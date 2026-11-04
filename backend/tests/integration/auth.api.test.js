import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, PASSWORD } from '../helpers/integration.js';
import { User } from '../../src/models/index.js';

let h;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());

describe('Auth API', () => {
  test('register → 201, cookie set, password hashed with bcrypt', async () => {
    const res = await h.api.post('/api/auth/register').send({ name: 'Nouvelle', email: 'new@t.tn', password: 'Motdepasse1', acceptTerms: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');
    assert.match(res.headers['set-cookie'][0], /iv_token=.*HttpOnly.*SameSite=Strict/i);
    const doc = await User.findOne({ email: 'new@t.tn' }).select('+passwordHash').lean();
    assert.match(doc.passwordHash, /^\$2[aby]\$/);
  });

  test('cannot register as administrator', async () => {
    const res = await h.api.post('/api/auth/register').send({ name: 'Hacker', email: 'h@t.tn', password: 'Motdepasse1', role: 'admin', acceptTerms: true });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.role);
    assert.equal(await User.countDocuments({ email: 'h@t.tn' }), 0);
  });

  test('invalid input returns field errors', async () => {
    const res = await h.api.post('/api/auth/register').send({ name: 'A', email: 'bad', password: '123' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.email && res.body.error.fields.password && res.body.error.fields.name);
  });

  test('login, me, logout', async () => {
    const login = await h.api.post('/api/auth/login').send({ email: 'user@t.tn', password: PASSWORD });
    assert.equal(login.status, 200);
    const me = await h.api.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(me.body.user.email, 'user@t.tn');
    assert.equal((await h.api.post('/api/auth/logout')).status, 204);
  });

  test('wrong password → 401; no token → 401; tampered token → 401', async () => {
    assert.equal((await h.api.post('/api/auth/login').send({ email: 'user@t.tn', password: 'nope' })).status, 401);
    assert.equal((await h.api.get('/api/auth/me')).status, 401);
    assert.equal((await h.api.get('/api/auth/me').set('Authorization', `Bearer ${h.tokens.user}x`)).status, 401);
  });

  test('NoSQL injection in login is neutralised', async () => {
    const res = await h.api.post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.equal(res.status, 400);
  });

  test('cookie session requires the CSRF header for writes', async () => {
    const agent = (await import('supertest')).default.agent(h.app);
    await agent.post('/api/auth/login').send({ email: 'user@t.tn', password: PASSWORD });
    assert.equal((await agent.get('/api/auth/me')).status, 200);
    assert.equal((await agent.put('/api/users/me/preferences').send({ highContrast: true })).status, 403);
    assert.equal((await agent.put('/api/users/me/preferences').set('X-Requested-With', 'XMLHttpRequest').send({ highContrast: true })).status, 200);
  });

  test('password reset through the development outbox', async () => {
    await h.api.post('/api/auth/register').send({ name: 'Reset', email: 'reset@t.tn', password: 'Motdepasse1', acceptTerms: true });
    const fp = await h.api.post('/api/auth/forgot-password').send({ email: 'reset@t.tn' });
    assert.equal(fp.status, 200);
    const outbox = await h.api.get('/api/dev/outbox').query({ to: 'reset@t.tn' });
    assert.equal(outbox.body.items[0].status, 'logged');
    const token = outbox.body.items[0].text.match(/token=([a-f0-9]{64})/)[1];
    assert.equal((await h.api.post('/api/auth/reset-password').send({ token, password: 'Nouveau123' })).status, 200);
    assert.equal((await h.api.post('/api/auth/login').send({ email: 'reset@t.tn', password: 'Nouveau123' })).status, 200);
    assert.equal((await h.api.post('/api/auth/reset-password').send({ token, password: 'Encore1234' })).status, 400);
  });

  test('preferences persist between sessions', async () => {
    await h.api.put('/api/users/me/preferences').set(h.as('user2')).send({ fontScale: 150, highContrast: true, preferredFeatures: ['signLanguage'] });
    const login = await h.api.post('/api/auth/login').send({ email: 'user2@t.tn', password: PASSWORD });
    assert.equal(login.body.user.preferences.fontScale, 150);
    assert.deepEqual(login.body.user.preferences.preferredFeatures, ['signLanguage']);
  });

  test('suspended account is blocked immediately', async () => {
    const reg = await h.api.post('/api/auth/register').send({ name: 'Bientôt', email: 'susp@t.tn', password: 'Motdepasse1', acceptTerms: true });
    await h.api.patch(`/api/admin/users/${reg.body.user.id}`).set(h.as('admin')).send({ status: 'suspended' });
    assert.equal((await h.api.get('/api/auth/me').set('Authorization', `Bearer ${reg.body.token}`)).status, 403);
  });
});
