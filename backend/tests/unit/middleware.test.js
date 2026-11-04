import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validate, sanitize, sanitizeRequest, errorHandler } from '../../src/middleware/common.js';
import { authorize, createAuthMiddleware, requireCsrfHeader, AUTH_COOKIE } from '../../src/middleware/auth.js';
import { AppError } from '../../src/utils/errors.js';
import { fakeTokens } from '../helpers/fakes.js';

const run = (mw, req) => new Promise((resolve) => mw(req, {}, (err) => resolve({ err, req })));
const resMock = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};

describe('validate middleware', () => {
  test('replaces body with parsed data and maps errors per field', async () => {
    const mw = validate({ body: z.object({ n: z.coerce.number().min(1, 'trop petit') }).strict() });
    const ok = await run(mw, { body: { n: '3' } });
    assert.equal(ok.req.body.n, 3);
    const bad = await run(mw, { body: { n: '0', extra: 1 } });
    assert.equal(bad.err.status, 400);
    assert.equal(bad.err.details.n, 'trop petit');
  });
});

describe('sanitize', () => {
  test('removes Mongo operators and dotted keys recursively', () => {
    assert.deepEqual(sanitize({ email: { $gt: '' }, a: [{ 'b.c': 1, d: 2 }] }), { email: {}, a: [{ d: 2 }] });
  });
  test('drops nested query objects', async () => {
    const { req } = await run(sanitizeRequest, { query: { q: 'ok', page: { $gt: 1 }, $where: 'x' }, body: {}, params: {} });
    assert.deepEqual(req.query, { q: 'ok' });
  });
});

describe('authorization', () => {
  test('authorize enforces roles', async () => {
    assert.equal((await run(authorize('admin'), { user: { role: 'user' } })).err.status, 403);
    assert.equal((await run(authorize('admin'), {})).err.status, 401);
    assert.equal((await run(authorize('admin', 'organizer'), { user: { role: 'organizer' } })).err, undefined);
  });

  const users = {
    u1: { _id: 'u1', role: 'user', status: 'active', name: 'U' },
    s1: { _id: 's1', role: 'user', status: 'suspended' },
    p1: { _id: 'p1', role: 'user', status: 'active', passwordChangedAt: new Date(Date.now() + 60_000) },
  };
  const auth = createAuthMiddleware({ verify: fakeTokens.verify, userRepo: { findById: async (id) => users[id] || null } });
  const tokenFor = (sub) => fakeTokens.sign({ sub });

  test('required: accepts bearer or cookie, rejects missing/invalid tokens', async () => {
    assert.equal((await run(auth.required, { headers: {} })).err.status, 401);
    assert.equal((await run(auth.required, { headers: { authorization: 'Bearer garbage' } })).err.status, 401);
    const viaHeader = await run(auth.required, { headers: { authorization: `Bearer ${tokenFor('u1')}` } });
    assert.equal(viaHeader.req.user.id, 'u1');
    const viaCookie = await run(auth.required, { headers: {}, cookies: { [AUTH_COOKIE]: tokenFor('u1') } });
    assert.equal(viaCookie.req.authVia, 'cookie');
  });

  test('required: suspended users and tokens older than a password change are refused', async () => {
    assert.equal((await run(auth.required, { headers: { authorization: `Bearer ${tokenFor('s1')}` } })).err.code, 'ACCOUNT_SUSPENDED');
    assert.equal((await run(auth.required, { headers: { authorization: `Bearer ${tokenFor('p1')}` } })).err.status, 401);
    assert.equal((await run(auth.required, { headers: { authorization: `Bearer ${tokenFor('ghost')}` } })).err.status, 401);
  });

  test('optional: invalid token behaves like a visitor', async () => {
    const r = await run(auth.optional, { headers: { authorization: 'Bearer garbage' } });
    assert.equal(r.err, undefined);
    assert.equal(r.req.user, null);
  });

  test('CSRF header required for cookie-authenticated writes only', async () => {
    const base = { cookies: { [AUTH_COOKIE]: 't' }, headers: {}, get: function (h) { return this.headers[h.toLowerCase()]; } };
    assert.equal((await run(requireCsrfHeader, { ...base, method: 'POST' })).err.status, 403);
    assert.equal((await run(requireCsrfHeader, { ...base, method: 'GET' })).err, undefined);
    assert.equal((await run(requireCsrfHeader, { ...base, method: 'POST', headers: { 'x-requested-with': 'XMLHttpRequest' } })).err, undefined);
    assert.equal((await run(requireCsrfHeader, { ...base, method: 'POST', headers: { authorization: 'Bearer x' } })).err, undefined);
  });
});

describe('error handler', () => {
  const h = errorHandler({ error() {} });
  test('AppError keeps status/code/fields', () => {
    const res = resMock();
    h(new AppError(409, 'X', 'msg', { a: 'b' }), {}, res, () => {});
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: { code: 'X', message: 'msg', fields: { a: 'b' } } });
  });
  test('unknown errors become 500 without leaking details', () => {
    const res = resMock();
    h(new Error('secret stack'), {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /secret/);
  });
  test('duplicate key → 409, cast error → 400', () => {
    const r1 = resMock();
    h({ code: 11000 }, {}, r1, () => {});
    assert.equal(r1.statusCode, 409);
    const r2 = resMock();
    h({ name: 'CastError' }, {}, r2, () => {});
    assert.equal(r2.statusCode, 400);
  });
});
