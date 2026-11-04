/**
 * Minimal RFC 5545 iCalendar generator (no dependency).
 * Handles text escaping and 75-octet line folding.
 */
const pad = (n) => String(n).padStart(2, '0');

export function toICalDate(date) {
  const d = new Date(date);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function escapeText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, 'utf8');
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + len > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * @param {Array<{uid:string,start:Date,end:Date,title:string,description?:string,location?:string,url?:string,status?:string}>} items
 */
export function buildCalendar(items, { name = 'InclusiVenue — Mes réservations', now = new Date() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InclusiVenue//Reservations//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const it of items) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${it.uid}`,
      `DTSTAMP:${toICalDate(now)}`,
      `DTSTART:${toICalDate(it.start)}`,
      `DTEND:${toICalDate(it.end)}`,
      `SUMMARY:${escapeText(it.title)}`,
    );
    if (it.description) lines.push(`DESCRIPTION:${escapeText(it.description)}`);
    if (it.location) lines.push(`LOCATION:${escapeText(it.location)}`);
    if (it.url) lines.push(`URL:${it.url}`);
    lines.push(`STATUS:${it.status || 'CONFIRMED'}`);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT24H',
      `DESCRIPTION:${escapeText(`Rappel : ${it.title}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
