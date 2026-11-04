/**
 * Periodic event reminders (24 h before start). Idempotent: each booking is
 * flagged with reminderSentAt atomically, so restarts or multiple instances do
 * not send duplicates. Set REMINDER_INTERVAL_MINUTES=0 to disable.
 */
export function startReminderJob(bookingService, intervalMinutes) {
  if (!intervalMinutes) return () => {};
  const run = async () => {
    try {
      const { sent } = await bookingService.sendReminders(24);
      if (sent) console.log(`[reminders] ${sent} reminder(s) created`);
    } catch (e) {
      console.error('[reminders] failed', e.message);
    }
  };
  const first = setTimeout(run, 10_000);
  const timer = setInterval(run, intervalMinutes * 60 * 1000);
  timer.unref();
  first.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
