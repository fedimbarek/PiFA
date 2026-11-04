export const ACCESSIBILITY_FEATURES = [
  { key: 'wheelchair', label: 'Accès fauteuil roulant', short: 'Fauteuil', icon: 'wheelchair' },
  { key: 'signLanguage', label: 'Interprétation en langue des signes', short: 'Langue des signes', icon: 'hands' },
  { key: 'hearingLoop', label: 'Boucle magnétique', short: 'Boucle magnétique', icon: 'ear' },
  { key: 'audioDescription', label: 'Audiodescription', short: 'Audiodescription', icon: 'audio' },
  { key: 'adaptedTransport', label: 'Transport adapté', short: 'Transport adapté', icon: 'bus' },
  { key: 'accessibleToilets', label: 'Sanitaires accessibles', short: 'Sanitaires PMR', icon: 'wc' },
  { key: 'subtitles', label: 'Sous-titrage / vélotypie', short: 'Sous-titrage', icon: 'cc' },
  { key: 'easyRead', label: 'Documents en FALC (facile à lire)', short: 'FALC', icon: 'book' },
  { key: 'braille', label: 'Documents en braille', short: 'Braille', icon: 'braille' },
  { key: 'quietSpace', label: 'Espace calme', short: 'Espace calme', icon: 'moon' },
  { key: 'assistanceDogs', label: "Chiens d'assistance acceptés", short: "Chiens d'assistance", icon: 'paw' },
  { key: 'reservedSeating', label: 'Places réservées PMR', short: 'Places PMR', icon: 'seat' },
];
export const FEATURE_LABEL = Object.fromEntries(ACCESSIBILITY_FEATURES.map((f) => [f.key, f.label]));

export const EVENT_STATUS_LABEL = {
  draft: 'Brouillon',
  pending: 'En attente de modération',
  published: 'Publié',
  rejected: 'Refusé',
  archived: 'Archivé',
};
export const EVENT_STATUS_TONE = { draft: 'muted', pending: 'warning', published: 'success', rejected: 'danger', archived: 'muted' };
export const ROLE_LABEL = { user: 'Participant', organizer: 'Organisateur', admin: 'Administrateur' };

const TZ = 'Africa/Tunis';
export const formatDate = (d, opts = { dateStyle: 'full' }) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts }).format(new Date(d));
export const formatDateTime = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }).format(new Date(d));
export const formatShort = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
export const formatTime = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, timeStyle: 'short' }).format(new Date(d));
export const dayParts = (d) => {
  const date = new Date(d);
  return {
    day: new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, month: 'short' }).format(date).replace('.', ''),
  };
};
export const formatPrice = (p) => (!p ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(p)} TND`);
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
export const percent = (v) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v || 0)} %`;

/** Value for <input type="datetime-local"> in Tunis time (UTC+1, no DST). */
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(new Date(d).getTime() + 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}
export function fromLocalInput(v) {
  if (!v) return null;
  return new Date(`${v}:00+01:00`).toISOString();
}

export const seatsLabel = (e) =>
  e.availableSeats === 0 ? 'Complet' : e.availableSeats <= 5 ? `Plus que ${plural(e.availableSeats, 'place', 'places')}` : plural(e.availableSeats, 'place disponible', 'places disponibles');
