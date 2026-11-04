import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { startReminderJob } from './jobs/reminders.js';
import { seedIfEmpty } from './seed/seed.js';

async function main() {
  await connectDb(env.MONGO_URL);
  console.log('[db] connected');
  if (env.SEED_ON_START) await seedIfEmpty();

  const app = createApp(env);
  const server = app.listen(env.PORT, () => {
    console.log(`[api] listening on :${env.PORT} — docs at ${env.PUBLIC_API_URL}/api-docs (mail mode: ${env.MAIL_MODE})`);
  });
  const stopJob = startReminderJob(app.locals.container.services.bookings, env.REMINDER_INTERVAL_MINUTES);

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    stopJob();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
