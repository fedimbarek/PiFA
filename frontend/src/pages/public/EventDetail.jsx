import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, assetUrl, download } from '../../lib/api.js';
import { ACCESSIBILITY_FEATURES, formatDateTime, formatPrice, formatTime, seatsLabel } from '../../lib/format.js';
import { Icon } from '../../components/Icon.jsx';
import { ConfirmDialog } from '../../components/Modal.jsx';
import { ErrorState, Loading, StatusBadge } from '../../components/ui.jsx';

const MapView = lazy(() => import('../../components/MapView.jsx').then((m) => ({ default: m.MapView })));

/** Read the description aloud with the browser speech engine (no data leaves the device). */
function ListenButton({ text }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => supported && window.speechSynthesis.cancel(), [supported]);
  if (!supported) return null;
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return (
    <button type="button" className="btn btn--secondary btn--sm" onClick={toggle} aria-pressed={speaking}>
      <Icon name="audio" size={18} /> {speaking ? 'Arrêter la lecture' : 'Écouter la description'}
    </button>
  );
}

function BookingBox({ event, onBooked }) {
  const { user, refreshUnread } = useAuth();
  const { prefs } = usePreferences();
  const toast = useToast();
  const location = useLocation();
  const [seats, setSeats] = useState(1);
  const [needs, setNeeds] = useState(() => (prefs.preferredFeatures || []).filter((k) => event.accessibility?.[k]));
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const started = new Date(event.startDate) <= new Date();
  const max = Math.min(4, event.availableSeats);
  const offered = ACCESSIBILITY_FEATURES.filter((f) => event.accessibility?.[f.key]);

  if (event.status !== 'published') {
    return <p className="alert alert--info">Cet événement n'est pas ouvert à la réservation ({event.status === 'archived' ? 'archivé' : 'non publié'}).</p>;
  }
  if (event.myBooking) {
    return (
      <div className="alert alert--success" style={{ display: 'block' }}>
        <p>
          <strong>Vous avez réservé {event.myBooking.seats} place(s).</strong> Référence : {event.myBooking.reference}
        </p>
        <div className="row">
          <Link to="/mon-espace/reservations" className="btn btn--sm">
            Gérer ma réservation
          </Link>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => download(`/bookings/${event.myBooking.id}/calendar.ics`, 'reservation.ics').catch((e) => toast.error(e.message))}>
            <Icon name="calendar" size={18} /> Ajouter à mon agenda
          </button>
        </div>
      </div>
    );
  }
  if (started) return <p className="alert alert--info">Cet événement a commencé : les réservations sont closes.</p>;
  if (event.availableSeats === 0) return <p className="alert alert--warning">Cet événement est complet.</p>;
  if (!user) {
    return (
      <div className="stack">
        <p>Connectez-vous pour réserver vos places et signaler vos besoins à l'organisateur.</p>
        <Link to="/connexion" state={{ from: location.pathname }} className="btn btn--block">
          Se connecter pour réserver
        </Link>
        <Link to="/inscription" state={{ from: location.pathname }} className="btn btn--secondary btn--block">
          Créer un compte gratuit
        </Link>
      </div>
    );
  }

  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/bookings', { eventId: event.id, seats, accessibilityNeeds: needs, note: note.trim() || undefined });
      setConfirm(false);
      toast.success(`Réservation ${r.booking.reference} confirmée. Une notification vous a été envoyée.`, { title: 'C’est réservé !' });
      refreshUnread();
      onBooked();
    } catch (e) {
      setConfirm(false);
      setError(e.message);
      if (e.code === 'NOT_ENOUGH_SEATS' || e.code === 'ALREADY_BOOKED') onBooked();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        setConfirm(true);
      }}
      aria-labelledby="book-title"
    >
      {error && (
        <p className="alert alert--error" role="alert">
          <Icon name="alert" /> {error}
        </p>
      )}
      <div className="field">
        <label htmlFor="seats">Nombre de places</label>
        <select id="seats" className="select" value={seats} onChange={(e) => setSeats(Number(e.target.value))} aria-describedby="seats-hint">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span id="seats-hint" className="hint">Maximum 4 places par réservation.</span>
      </div>
      {offered.length > 0 && (
        <fieldset>
          <legend>Services dont vous aurez besoin</legend>
          <p className="hint">L'organisateur sera prévenu pour préparer votre accueil.</p>
          {offered.map((f) => (
            <label key={f.key} className="check">
              <input type="checkbox" checked={needs.includes(f.key)} onChange={() => setNeeds((n) => (n.includes(f.key) ? n.filter((x) => x !== f.key) : [...n, f.key]))} />
              {f.label}
            </label>
          ))}
        </fieldset>
      )}
      <div className="field">
        <label htmlFor="note">Message à l'organisateur (facultatif)</label>
        <textarea id="note" className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. je viendrai avec un accompagnateur" />
      </div>
      <button type="submit" className="btn btn--block btn--gold">
        <Icon name="ticket" /> Réserver {seats > 1 ? `${seats} places` : 'ma place'}
      </button>
      <ConfirmDialog
        open={confirm}
        title="Confirmer la réservation"
        message={`${event.title} — ${formatDateTime(event.startDate)}`}
        confirmLabel="Confirmer la réservation"
        busy={busy}
        onConfirm={book}
        onCancel={() => setConfirm(false)}
      >
        <dl className="dl">
          <dt>Places</dt>
          <dd>{seats}</dd>
          <dt>Tarif</dt>
          <dd>{event.price ? `${formatPrice(event.price * seats)} (à régler sur place)` : 'Gratuit'}</dd>
          <dt>Besoins signalés</dt>
          <dd>{needs.length ? needs.map((k) => ACCESSIBILITY_FEATURES.find((f) => f.key === k)?.label).join(', ') : 'Aucun'}</dd>
        </dl>
      </ConfirmDialog>
    </form>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/events/${id}`);
  const event = data?.event;
  useTitle(event?.title || 'Événement');

  if (loading && !event) return <div className="container section"><Loading /></div>;
  if (error) {
    return (
      <div className="container section">
        <h1>Événement introuvable</h1>
        <ErrorState error={error} />
        <p className="center" style={{ marginTop: 'var(--sp-4)' }}>
          <Link to="/evenements">Retour à la liste des événements</Link>
        </p>
      </div>
    );
  }
  const features = ACCESSIBILITY_FEATURES.filter((f) => event.accessibility?.[f.key]);
  const missing = ACCESSIBILITY_FEATURES.filter((f) => !event.accessibility?.[f.key]);

  return (
    <article>
      <div className="page-head on-dark" style={{ paddingBottom: 'var(--sp-7)' }}>
        <div className="container">
          <nav aria-label="Fil d'Ariane" className="breadcrumb">
            <ol>
              <li><Link to="/">Accueil</Link></li>
              <li><Link to="/evenements">Événements</Link></li>
              <li><span aria-current="page">{event.title}</span></li>
            </ol>
          </nav>
          <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
            {event.category?.name && <span className="badge badge--gold">{event.category.name}</span>}
            {event.status !== 'published' && <StatusBadge status={event.status} />}
          </div>
          <h1>{event.title}</h1>
          {event.summary && <p style={{ fontSize: 'var(--fs-lg)' }}>{event.summary}</p>}
        </div>
      </div>

      <div className="container" style={{ marginTop: 'calc(-1 * var(--sp-6))' }}>
        <div className="detail-layout">
          <div className="stack">
            {event.coverImage?.url && (
              <img src={assetUrl(event.coverImage.url)} alt={event.coverImage.alt || ''} width="1200" height="675" style={{ borderRadius: 'var(--radius-lg)', width: '100%', height: 'auto', boxShadow: 'var(--shadow)' }} fetchpriority="high" />
            )}
            <section className="panel" aria-labelledby="about-title">
              <div className="row-between">
                <h2 id="about-title">Présentation</h2>
                <ListenButton text={`${event.title}. ${event.description}`} />
              </div>
              {event.description.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
            <section className="panel" aria-labelledby="a11y-title">
              <h2 id="a11y-title">Accessibilité</h2>
              {features.length ? (
                <ul className="check-grid" style={{ listStyle: 'none', padding: 0 }}>
                  {features.map((f) => (
                    <li key={f.key} className="row" style={{ minHeight: 'var(--touch)' }}>
                      <span className="badge" aria-hidden="true"><Icon name={f.icon} size={18} /></span>
                      {f.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun service d'accessibilité n'a été renseigné par l'organisateur.</p>
              )}
              {event.venue?.accessInstructions && (
                <>
                  <h3>Accès au lieu</h3>
                  <p>{event.venue.accessInstructions}</p>
                </>
              )}
              {event.accessibilityNotes && (
                <>
                  <h3>Informations complémentaires</h3>
                  <p>{event.accessibilityNotes}</p>
                </>
              )}
              {missing.length > 0 && (
                <details>
                  <summary>Services non proposés pour cet événement ({missing.length})</summary>
                  <ul>{missing.map((f) => <li key={f.key}>{f.label}</li>)}</ul>
                </details>
              )}
            </section>
            {typeof event.venue?.latitude === 'number' && (
              <section className="panel" aria-labelledby="where-title">
                <h2 id="where-title">Lieu</h2>
                <address style={{ fontStyle: 'normal', marginBottom: 'var(--sp-3)' }}>
                  <strong>{event.venue.name}</strong>
                  <br />
                  {event.venue.address}, {event.venue.city}
                </address>
                <Suspense fallback={<Loading label="Chargement de la carte…" />}>
                  <MapView events={[event]} height={300} label={`Carte : ${event.venue.name}`} />
                </Suspense>
              </section>
            )}
          </div>

          <aside className="panel booking-aside" aria-labelledby="book-title">
            <h2 id="book-title" style={{ fontSize: 'var(--fs-xl)' }}>Infos pratiques</h2>
            <dl className="dl" style={{ marginBottom: 'var(--sp-4)' }}>
              <dt><Icon name="calendar" size={18} /> <span className="sr-only">Date</span></dt>
              <dd>{formatDateTime(event.startDate)} – {formatTime(event.endDate)}</dd>
              <dt><Icon name="pin" size={18} /> <span className="sr-only">Lieu</span></dt>
              <dd>{event.venue.name}, {event.venue.address}, {event.venue.city}</dd>
              <dt><Icon name="euro" size={18} /> <span className="sr-only">Tarif</span></dt>
              <dd>{formatPrice(event.price)}</dd>
              <dt><Icon name="users" size={18} /> <span className="sr-only">Places</span></dt>
              <dd>
                <strong>{seatsLabel(event)}</strong> sur {event.capacity}
              </dd>
              <dt><Icon name="heart" size={18} /> <span className="sr-only">Organisateur</span></dt>
              <dd>{event.organizer?.organizationName || event.organizer?.name}</dd>
            </dl>
            <BookingBox event={event} onBooked={reload} />
          </aside>
        </div>
      </div>
    </article>
  );
}
