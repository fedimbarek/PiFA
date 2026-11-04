/**
 * Email sending.
 *  - mode "smtp": sends through the injected nodemailer transport (real provider).
 *  - mode "log" : development mode. The email is stored in the EmailLog outbox with
 *    status "logged" and printed to the console. It is NOT sent, and the API never
 *    reports it as sent.
 */
export function createMailService({ mode, transport, from, emailLogRepo, logger = console }) {
  async function send({ to, subject, text }) {
    if (mode === 'smtp' && transport) {
      try {
        await transport.sendMail({ from, to, subject, text });
        await emailLogRepo.create({ to, subject, text, mode, status: 'sent' });
        return 'sent';
      } catch (err) {
        logger.error?.(`[mail] SMTP error for ${to}: ${err.message}`);
        await emailLogRepo.create({ to, subject, text, mode, status: 'failed', error: err.message });
        return 'failed';
      }
    }
    await emailLogRepo.create({ to, subject, text, mode: 'log', status: 'logged' });
    // Printed in full so a local/demo operator can follow links (e.g. password reset) from the logs.
    logger.info?.(`[mail:dev-outbox] NOT SENT (MAIL_MODE=log) to=${to} subject="${subject}"\n${text}`);
    return 'logged';
  }
  return { send, mode: mode === 'smtp' && transport ? 'smtp' : 'log' };
}
