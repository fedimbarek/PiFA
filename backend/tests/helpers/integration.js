/**
 * Integration test harness: real Express app + real MongoDB (mongodb-memory-server)
 * + real bcrypt/JWT. Requires network access on first run to download mongod.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { connectDb } from '../../src/config/db.js';
import { Category, User } from '../../src/models/index.js';

export const PASSWORD = 'Password123';

export const testEnv = (over = {}) => ({
  NODE_ENV: 'test',
  PORT: 0,
  JWT_SECRET: 'integration-test-secret-0123456789abcdef',
  JWT_EXPIRES_IN: '1h',
  CLIENT_URL: 'http://localhost:5173',
  PUBLIC_API_URL: 'http://localhost:4000',
  COOKIE_SECURE: false,
  UPLOAD_DIR: path.join(os.tmpdir(), `iv-uploads-${process.pid}`),
  MAX_UPLOAD_MB: 2,
  MAIL_MODE: 'log',
  MAIL_FROM: 'test@iv',
  RATE_LIMIT_MAX: 1000,
  AUTH_RATE_LIMIT_MAX: 1000,
  REMINDER_INTERVAL_MINUTES: 0,
  ...over,
});

export async function startHarness(envOver) {
  const mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri('inclusivenue-test'));
  const env = testEnv(envOver);
  const app = createApp(env, { logger: { error() {}, info() {} } });
  const api = request(app);

  const hash = await app.locals.container.hasher.hash(PASSWORD);
  const [admin, orga, orga2, user, user2] = await User.insertMany([
    { name: 'Admin', email: 'admin@t.tn', role: 'admin', passwordHash: hash },
    { name: 'Orga', email: 'orga@t.tn', role: 'organizer', organizationName: 'Asso', passwordHash: hash },
    { name: 'Orga2', email: 'orga2@t.tn', role: 'organizer', organizationName: 'Asso2', passwordHash: hash },
    { name: 'User', email: 'user@t.tn', role: 'user', passwordHash: hash },
    { name: 'User2', email: 'user2@t.tn', role: 'user', passwordHash: hash },
  ]);
  const category = await Category.create({ name: 'Atelier', slug: 'atelier' });

  const tokens = {};
  for (const [k, u] of Object.entries({ admin, orga, orga2, user, user2 })) {
    const res = await api.post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    tokens[k] = res.body.token;
  }
  const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

  const eventBody = (over = {}) => ({
    title: 'Atelier accessible',
    summary: 'Résumé',
    description: 'Une description suffisamment longue pour un test.',
    category: String(category._id),
    startDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
    venue: { name: 'Salle', address: '1 rue', city: 'Tunis', latitude: 36.8, longitude: 10.18 },
    capacity: 3,
    price: 0,
    accessibility: { wheelchair: true, signLanguage: true },
    ...over,
  });

  /** Create as organizer, submit and approve as admin. */
  async function publishedEvent(over, owner = 'orga') {
    const c = await api.post('/api/events').set(as(owner)).send(eventBody(over));
    if (c.status !== 201) throw new Error(`create failed ${c.status} ${JSON.stringify(c.body)}`);
    await api.post(`/api/events/${c.body.event.id}/submit`).set(as(owner));
    await api.post(`/api/admin/events/${c.body.event.id}/approve`).set(as('admin'));
    return c.body.event.id;
  }

  async function stop() {
    await mongoose.disconnect();
    await mongo.stop();
    await fs.rm(env.UPLOAD_DIR, { recursive: true, force: true });
  }

  return { app, api, env, as, tokens, users: { admin, orga, orga2, user, user2 }, category, eventBody, publishedEvent, stop };
}
