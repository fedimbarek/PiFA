import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { api, assetUrl } from '../../lib/api.js';
import { ACCESSIBILITY_FEATURES, EVENT_STATUS_LABEL, FEATURE_LABEL, formatShort, fromLocalInput, percent, plural, toLocalInput } from '../../lib/format.js';
import { eventFormSchema } from '../../lib/validation.js';
import { Icon } from '../../components/Icon.jsx';
import { ConfirmDialog } from '../../components/Modal.jsx';
import { BarChart, Occupancy, StatCard } from '../../components/charts.jsx';
import { applyServerErrors, EmptyState, ErrorState, ErrorSummary, Loading, PageHeader, SpaceLayout, StatusBadge, TextField } from '../../components/ui.jsx';

export const ORG_LINKS = [
  { to: '/organisateur', label: 'Tableau de bord', icon: 'grid', end: true },
  { to: '/organisateur/evenements', label: 'Mes événements', icon: 'calendar', end: true },
  { to: '/organisateur/evenements/nouveau', label: 'Créer un événement', icon: 'plus' },
  { to: '/organisateur/statistiques', label: 'Statistiques', icon: 'chart' },
];

function OrgSpace({ title, intro, actions, crumbs, children }) {
  return (
    <>
      <PageHeader title={title} intro={intro} eyebrow="Espace organisateur" actions={actions} crumbs={crumbs || [{ label: 'Accueil', to: '/' }, { label: 'Organisateur', to: '/organisateur' }, { label: title }]} />
      <SpaceLayout title="Espace organisateur" links={ORG_LINKS}>
        {children}
      </SpaceLayout>
    </>
  );
}

const NewEventBtn = () => (
  <Link to="/organisateur/evenements/nouveau" className="btn btn--gold">
    <Icon name="plus" /> Créer un événement
  </Link>
);

export function OrganizerDashboard() {
  useTitle('Espace organisateur');
  const stats = useApi('/organizer/stats');
  const events = useApi('/organizer/events');
  if (stats.error) return <OrgSpace title="Tableau de bord"><ErrorState error={stats.error} onRetry={stats.reload} /></OrgSpace>;
  if (stats.loading || events.loading) return <OrgSpace title="Tableau de bord"><Loading /></OrgSpace>;
  const s = stats.data.stats;
  const upcoming = (events.data?.items || []).filter((e) => e.status === 'published' && new Date(e.startDate) > new Date()).sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).slice(0, 5);
  const attention = (events.data?.items || []).filter((e) => ['rejected', 'draft', 'pending'].includes(e.status));
  return (
    <OrgSpace title="Tableau de bord" intro="Vue d'ensemble de vos événements et de leur fréquentation (données en temps réel)." actions={<NewEventBtn />}>
      <ul className="stat-grid" aria-label="Indicateurs clés">
        <StatCard label="Événements au total" value={s.totalEvents} icon="calendar" />
        <StatCard label="Publiés" value={s.publishedEvents} icon="check" tone="success" />
        <StatCard label="À venir" value={s.upcomingEvents} icon="clock" tone="gold" />
        <StatCard label="Réservations" value={s.totalReservations} icon="ticket" hint={`${plural(s.seatsBooked, 'place réservée', 'places réservées')}`} />
        <StatCard label="Places disponibles" value={s.availableSeats} icon="users" hint={`sur ${s.totalCapacity} au total`} />
        <StatCard label="Taux de remplissage" value={percent(s.occupancyRate)} icon="chart" tone="warning" />
      </ul>
      <div className="grid-2">
        <section className="panel" aria-labelledby="up-title">
          <h2 id="up-title" style={{ fontSize: 'var(--fs-xl)' }}>Prochains événements</h2>
          {upcoming.length ? (
            <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
              {upcoming.map((e) => (
                <li key={e.id}>
                  <div className="row-between">
                    <Link to={`/organisateur/evenements/${e.id}/reservations`}><strong>{e.title}</strong></Link>
                    <span className="small muted">{formatShort(e.startDate)}</span>
                  </div>
                  <Occupancy value={e.occupancyRate} label={`${e.bookedSeats} / ${e.capacity} places réservées`} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="calendar" title="Aucun événement publié à venir" action={<NewEventBtn />} />
          )}
        </section>
        <section className="panel" aria-labelledby="att-title">
          <h2 id="att-title" style={{ fontSize: 'var(--fs-xl)' }}>À traiter</h2>
          {attention.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {attention.map((e) => (
                <li key={e.id} style={{ padding: 'var(--sp-3) 0', borderTop: '1px solid var(--line)' }}>
                  <div className="row-between">
                    <Link to={`/organisateur/evenements/${e.id}/modifier`}>{e.title}</Link>
                    <StatusBadge status={e.status} />
                  </div>
                  {e.status === 'rejected' && e.moderation?.reason && <p className="small" style={{ margin: 'var(--sp-2) 0 0' }}><strong>Motif :</strong> {e.moderation.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Rien à signaler : tous vos événements sont publiés ou archivés.</p>
          )}
        </section>
      </div>
    </OrgSpace>
  );
}

export function MyEvents() {
  useTitle('Mes événements');
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi('/organizer/events', { status: status || undefined });
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const { type, event } = action;
    setBusy(true);
    try {
      if (type === 'delete') await api.del(`/events/${event.id}`);
      else {
        const r = await api.post(`/events/${event.id}/${type}`);
        if (type === 'submit') toast.success(r.event.status === 'published' ? 'Événement publié.' : "Événement envoyé en modération. Vous serez notifié(e) de la décision.");
        if (type === 'archive') toast.success(r.event.cancelledBookings ? `Événement archivé. ${plural(r.event.cancelledBookings, 'réservation annulée', 'réservations annulées')} et participants prévenus.` : 'Événement archivé.');
        if (type === 'unsubmit') toast.success('Événement repassé en brouillon.');
      }
      if (type === 'delete') toast.success('Événement supprimé.');
      setAction(null);
      reload();
    } catch (e) {
      toast.error(e.message);
      setAction(null);
    } finally {
      setBusy(false);
    }
  };
  const texts = {
    submit: ['Soumettre à la modération ?', "L'équipe vérifiera les informations avant publication.", 'Soumettre'],
    unsubmit: ['Retirer de la modération ?', "L'événement repassera en brouillon.", 'Retirer'],
    archive: ['Archiver cet événement ?', "S'il n'a pas encore eu lieu, les réservations seront annulées et les participants prévenus.", 'Archiver'],
    delete: ['Supprimer définitivement ?', 'Cette action est irréversible.', 'Supprimer'],
  };

  return (
    <OrgSpace title="Mes événements" intro="Créez, modifiez, publiez et archivez vos événements." actions={<NewEventBtn />}>
      <div className="field" style={{ maxWidth: 300, marginBottom: 'var(--sp-4)' }}>
        <label htmlFor="status-filter">Statut</label>
        <select id="status-filter" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(EVENT_STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Loading />
      ) : data.items.length ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Liste de mes événements</caption>
            <thead>
              <tr>
                <th scope="col">Événement</th>
                <th scope="col">Date</th>
                <th scope="col">Statut</th>
                <th scope="col">Places</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.title}</strong>
                    <div className="small muted">{e.venue.city} · {e.category?.name}</div>
                    {e.status === 'rejected' && e.moderation?.reason && <div className="small" style={{ color: 'var(--danger-700)' }}>Motif : {e.moderation.reason}</div>}
                  </td>
                  <td>{formatShort(e.startDate)}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>{e.bookedSeats} / {e.capacity}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {e.status !== 'archived' && <Link className="btn btn--ghost btn--sm" to={`/organisateur/evenements/${e.id}/modifier`}><Icon name="edit" size={16} /> Modifier<span className="sr-only"> : {e.title}</span></Link>}
                      {['published', 'archived'].includes(e.status) && <Link className="btn btn--ghost btn--sm" to={`/organisateur/evenements/${e.id}/reservations`}><Icon name="ticket" size={16} /> Réservations<span className="sr-only"> : {e.title}</span></Link>}
                      {['published'].includes(e.status) && <Link className="btn btn--ghost btn--sm" to={`/evenements/${e.id}`}><Icon name="eye" size={16} /> Voir<span className="sr-only"> : {e.title}</span></Link>}
                      {['draft', 'rejected'].includes(e.status) && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAction({ type: 'submit', event: e })}><Icon name="send" size={16} /> Publier<span className="sr-only"> : {e.title}</span></button>}
                      {e.status === 'pending' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAction({ type: 'unsubmit', event: e })}>Retirer<span className="sr-only"> : {e.title}</span></button>}
                      {e.status !== 'archived' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAction({ type: 'archive', event: e })}><Icon name="archive" size={16} /> Archiver<span className="sr-only"> : {e.title}</span></button>}
                      {['draft', 'rejected', 'pending'].includes(e.status) && e.bookedSeats === 0 && <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }} onClick={() => setAction({ type: 'delete', event: e })}><Icon name="trash" size={16} /> Supprimer<span className="sr-only"> : {e.title}</span></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="calendar" title="Aucun événement" action={<NewEventBtn />}>Créez votre premier événement : il sera enregistré en brouillon.</EmptyState>
      )}
      {action && (
        <ConfirmDialog open title={texts[action.type][0]} message={`« ${action.event.title} » — ${texts[action.type][1]}`} confirmLabel={texts[action.type][2]} tone={['delete', 'archive'].includes(action.type) ? 'danger' : 'primary'} busy={busy} onConfirm={run} onCancel={() => setAction(null)} />
      )}
    </OrgSpace>
  );
}

const LABELS = { title: 'Titre', description: 'Description', category: 'Catégorie', startDate: 'Début', endDate: 'Fin', venueName: 'Lieu', address: 'Adresse', city: 'Ville', capacity: 'Capacité', price: 'Prix', latitude: 'Latitude', longitude: 'Longitude' };
const SERVER_MAP = { 'venue.name': 'venueName', 'venue.address': 'address', 'venue.city': 'city', 'venue.latitude': 'latitude', 'venue.longitude': 'longitude' };

export function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useTitle(editing ? "Modifier l'événement" : 'Créer un événement');
  const navigate = useNavigate();
  const toast = useToast();
  const { data: cats } = useApi('/categories');
  const existing = useApi(editing ? `/events/${id}` : null);
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const fileRef = useRef(null);
  const { register, handleSubmit, reset, setError, watch, formState: { errors, isSubmitting, submitCount } } = useForm({
    resolver: zodResolver(eventFormSchema),
    shouldFocusError: false,
    defaultValues: { price: 0, capacity: 30, accessibility: {} },
  });
  const ev = existing.data?.event;
  const description = watch('description') || '';

  useEffect(() => {
    if (!ev) return;
    reset({
      title: ev.title,
      summary: ev.summary,
      description: ev.description,
      category: ev.category?._id || ev.category,
      startDate: toLocalInput(ev.startDate),
      endDate: toLocalInput(ev.endDate),
      venueName: ev.venue.name,
      address: ev.venue.address,
      city: ev.venue.city,
      latitude: ev.venue.latitude ?? '',
      longitude: ev.venue.longitude ?? '',
      accessInstructions: ev.venue.accessInstructions,
      price: ev.price,
      capacity: ev.capacity,
      accessibility: Object.fromEntries(ACCESSIBILITY_FEATURES.map((f) => [f.key, Boolean(ev.accessibility?.[f.key])])),
      accessibilityNotes: ev.accessibilityNotes,
      coverAlt: ev.coverImage?.alt,
    });
  }, [ev, reset]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    setImageError('');
    if (!f) return setImage(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setImageError('Formats acceptés : JPEG, PNG ou WebP.');
      e.target.value = '';
      return setImage(null);
    }
    if (f.size > 2 * 1024 * 1024) {
      setImageError("L'image dépasse 2 Mo.");
      e.target.value = '';
      return setImage(null);
    }
    setImage(f);
  };

  const onSubmit = async (v, submitAfter = false) => {
    if (image && !v.coverAlt) {
      setError('coverAlt', { message: "Décrivez l'image pour les personnes qui ne la voient pas (texte alternatif)." });
      return;
    }
    const body = {
      title: v.title,
      summary: v.summary || '',
      description: v.description,
      category: v.category,
      startDate: fromLocalInput(v.startDate),
      endDate: fromLocalInput(v.endDate),
      venue: { name: v.venueName, address: v.address, city: v.city, accessInstructions: v.accessInstructions || '', latitude: v.latitude ?? null, longitude: v.longitude ?? null },
      price: v.price,
      capacity: v.capacity,
      accessibility: v.accessibility,
      accessibilityNotes: v.accessibilityNotes || '',
      coverAlt: v.coverAlt || '',
    };
    try {
      const r = editing ? await api.patch(`/events/${id}`, body) : await api.post('/events', body);
      const eid = r.event.id;
      if (image) {
        const fd = new FormData();
        fd.append('image', image);
        fd.append('alt', v.coverAlt);
        await api.post(`/events/${eid}/image`, fd);
      }
      if (submitAfter) {
        const s = await api.post(`/events/${eid}/submit`);
        toast.success(s.event.status === 'published' ? 'Événement enregistré et publié.' : 'Événement enregistré et envoyé en modération.');
      } else {
        toast.success(editing ? 'Modifications enregistrées.' : 'Brouillon enregistré.');
      }
      navigate('/organisateur/evenements');
    } catch (e) {
      applyServerErrors(e, setError, SERVER_MAP);
      toast.error(e.message);
      setTimeout(() => document.getElementById('error-summary')?.focus(), 0);
    }
  };
  const onInvalid = () => setTimeout(() => document.getElementById('error-summary')?.focus(), 0);

  if (editing && existing.loading) return <OrgSpace title="Modifier l'événement"><Loading /></OrgSpace>;
  if (editing && existing.error) return <OrgSpace title="Modifier l'événement"><ErrorState error={existing.error} /></OrgSpace>;
  const canSubmit = !editing || ['draft', 'rejected'].includes(ev?.status);

  return (
    <OrgSpace title={editing ? "Modifier l'événement" : 'Créer un événement'} intro="Les champs marqués d'un astérisque (*) sont obligatoires. Plus les informations d'accessibilité sont précises, plus votre public pourra venir sereinement.">
      <form className="form" noValidate onSubmit={handleSubmit((v) => onSubmit(v, false), onInvalid)}>
        {submitCount > 0 && <ErrorSummary errors={errors} labels={LABELS} />}
        {ev?.status === 'rejected' && ev.moderation?.reason && (
          <p className="alert alert--warning"><Icon name="alert" /> <span><strong>Refusé par la modération :</strong> {ev.moderation.reason}</span></p>
        )}
        <section className="panel form" aria-labelledby="s-general">
          <h2 id="s-general" style={{ fontSize: 'var(--fs-xl)' }}>Informations générales</h2>
          <TextField id="f-title" label="Titre" required error={errors.title?.message} {...register('title')} />
          <TextField id="f-summary" label="Résumé court" hint="Affiché dans les listes (280 caractères max.)." error={errors.summary?.message} {...register('summary')} />
          <TextField id="f-description" as="textarea" rows={7} label="Description" required hint={`${description.length} / 8000 caractères. Séparez les paragraphes par une ligne vide.`} error={errors.description?.message} {...register('description')} />
          <div className="form-grid">
            <TextField id="f-category" as="select" label="Catégorie" required error={errors.category?.message} {...register('category')}>
              <option value="">— Choisir —</option>
              {cats?.categories?.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </TextField>
            <TextField id="f-startDate" type="datetime-local" label="Début (heure de Tunis)" required error={errors.startDate?.message} {...register('startDate')} />
            <TextField id="f-endDate" type="datetime-local" label="Fin" required error={errors.endDate?.message} {...register('endDate')} />
          </div>
        </section>

        <section className="panel form" aria-labelledby="s-venue">
          <h2 id="s-venue" style={{ fontSize: 'var(--fs-xl)' }}>Lieu</h2>
          <div className="form-grid">
            <TextField id="f-venueName" label="Nom du lieu" required error={errors.venueName?.message} {...register('venueName')} />
            <TextField id="f-address" label="Adresse" required autoComplete="street-address" error={errors.address?.message} {...register('address')} />
            <TextField id="f-city" label="Ville" required error={errors.city?.message} {...register('city')} />
          </div>
          <fieldset>
            <legend>Coordonnées GPS (facultatif, pour la carte)</legend>
            <p className="hint">Exemple pour Tunis centre : latitude 36.8 / longitude 10.18. Laissez vide pour ne pas afficher l'événement sur la carte.</p>
            <div className="form-grid">
              <TextField id="f-latitude" label="Latitude" inputMode="decimal" error={errors.latitude?.message} {...register('latitude', { setValueAs: (v) => (v === '' || v === null ? undefined : Number(String(v).replace(',', '.'))) })} />
              <TextField id="f-longitude" label="Longitude" inputMode="decimal" error={errors.longitude?.message} {...register('longitude', { setValueAs: (v) => (v === '' || v === null ? undefined : Number(String(v).replace(',', '.'))) })} />
            </div>
          </fieldset>
          <TextField id="f-accessInstructions" as="textarea" rows={3} label="Instructions d'accès" hint="Entrée accessible, ascenseur, parking PMR, transports proches…" error={errors.accessInstructions?.message} {...register('accessInstructions')} />
        </section>

        <section className="panel form" aria-labelledby="s-cap">
          <h2 id="s-cap" style={{ fontSize: 'var(--fs-xl)' }}>Places et tarif</h2>
          <div className="form-grid">
            <TextField id="f-capacity" type="number" min={1} label="Capacité totale" required hint={ev ? `${ev.bookedSeats} place(s) déjà réservée(s) : la capacité ne peut pas être inférieure.` : 'Nombre total de places.'} error={errors.capacity?.message} {...register('capacity')} />
            <TextField id="f-price" type="number" min={0} step="0.5" label="Prix par place (TND)" hint="0 = gratuit. Le paiement se fait sur place." error={errors.price?.message} {...register('price')} />
          </div>
        </section>

        <section className="panel form" aria-labelledby="s-a11y">
          <h2 id="s-a11y" style={{ fontSize: 'var(--fs-xl)' }}>Accessibilité</h2>
          <fieldset>
            <legend>Services proposés</legend>
            <div className="check-grid">
              {ACCESSIBILITY_FEATURES.map((f) => (
                <label key={f.key} className="check">
                  <input type="checkbox" {...register(`accessibility.${f.key}`)} /> {f.label}
                </label>
              ))}
            </div>
          </fieldset>
          <TextField id="f-accessibilityNotes" as="textarea" rows={3} label="Précisions sur l'accessibilité" hint="Horaires d'interprétation, nombre de casques d'audiodescription, contact sur place…" error={errors.accessibilityNotes?.message} {...register('accessibilityNotes')} />
        </section>

        <section className="panel form" aria-labelledby="s-img">
          <h2 id="s-img" style={{ fontSize: 'var(--fs-xl)' }}>Image de couverture</h2>
          {ev?.coverImage?.url && <img src={assetUrl(ev.coverImage.url)} alt={`Image actuelle : ${ev.coverImage.alt || 'sans description'}`} style={{ maxWidth: 320, borderRadius: 'var(--radius)' }} />}
          <div className="field">
            <label htmlFor="f-image">{ev?.coverImage?.url ? "Remplacer l'image" : 'Ajouter une image'} (facultatif)</label>
            <span id="f-image-hint" className="hint">JPEG, PNG ou WebP, 2 Mo maximum. L'image sera redimensionnée et compressée.</span>
            <input ref={fileRef} id="f-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} aria-describedby={`f-image-hint${imageError ? ' f-image-err' : ''}`} aria-invalid={imageError ? 'true' : undefined} className="input" />
            {imageError && <span id="f-image-err" className="field-error"><Icon name="alert" size={18} /> {imageError}</span>}
          </div>
          <TextField id="f-coverAlt" label="Texte alternatif de l'image" hint="Décrivez ce que montre l'image (obligatoire si une image est ajoutée)." error={errors.coverAlt?.message} {...register('coverAlt')} />
        </section>

        <div className="row">
          <button type="submit" className="btn btn--secondary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}
          </button>
          {canSubmit && (
            <button type="button" className="btn" disabled={isSubmitting} onClick={handleSubmit((v) => onSubmit(v, true), onInvalid)}>
              <Icon name="send" /> Enregistrer et publier
            </button>
          )}
          <Link to="/organisateur/evenements" className="btn btn--ghost">Annuler</Link>
        </div>
      </form>
    </OrgSpace>
  );
}

export function Reservations() {
  const { id } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/events/${id}/reservations`);
  useTitle(data ? `Réservations — ${data.event.title}` : 'Réservations');
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const checkIn = async (b, value) => {
    try {
      await api.patch(`/bookings/${b._id}/check-in`, { checkedIn: value });
      toast.success(value ? `${b.user?.name} : présence enregistrée.` : `${b.user?.name} : présence retirée.`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await api.post(`/bookings/${cancelling._id}/cancel`);
      toast.success('Réservation annulée, le participant a été prévenu.');
      setCancelling(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    const rows = [['Référence', 'Nom', 'E-mail', 'Places', 'Statut', 'Présent', 'Besoins', 'Message']];
    for (const b of data.bookings) rows.push([b.reference, b.user?.name, b.user?.email, b.seats, b.status, b.checkedIn ? 'oui' : 'non', (b.accessibilityNeeds || []).map((k) => FEATURE_LABEL[k]).join(' / '), b.note]);
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservations-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) return <OrgSpace title="Réservations"><ErrorState error={error} onRetry={reload} /></OrgSpace>;
  if (loading) return <OrgSpace title="Réservations"><Loading /></OrgSpace>;
  const { event, bookings, summary } = data;
  const shown = bookings.filter((b) => !q || `${b.user?.name} ${b.user?.email} ${b.reference}`.toLowerCase().includes(q.toLowerCase()));
  const needsCount = {};
  for (const b of bookings.filter((x) => x.status === 'confirmed')) for (const k of b.accessibilityNeeds || []) needsCount[k] = (needsCount[k] || 0) + b.seats;

  return (
    <OrgSpace title={`Réservations — ${event.title}`} intro={`${formatShort(event.startDate)} · ${event.venue.name}, ${event.venue.city}`} crumbs={[{ label: 'Organisateur', to: '/organisateur' }, { label: 'Mes événements', to: '/organisateur/evenements' }, { label: 'Réservations' }]}>
      <ul className="stat-grid">
        <StatCard label="Réservations confirmées" value={summary.reservations} icon="ticket" />
        <StatCard label="Places réservées" value={summary.seatsBooked} icon="users" hint={`sur ${event.capacity}`} />
        <StatCard label="Places disponibles" value={event.availableSeats} icon="check" tone="success" />
        <StatCard label="Présents" value={summary.checkedIn} icon="check" tone="gold" hint={summary.seatsBooked ? `${percent((summary.checkedIn / summary.seatsBooked) * 100)} des places` : undefined} />
        <StatCard label="Annulations" value={summary.cancelled} icon="close" tone="warning" />
      </ul>
      {Object.keys(needsCount).length > 0 && (
        <div className="alert alert--info" style={{ marginBottom: 'var(--sp-4)' }}>
          <Icon name="info" />
          <p style={{ margin: 0 }}>
            <strong>Besoins à prévoir :</strong> {Object.entries(needsCount).map(([k, n]) => `${FEATURE_LABEL[k]} (${n})`).join(', ')}.
          </p>
        </div>
      )}
      <div className="row-between" style={{ marginBottom: 'var(--sp-3)' }}>
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="r-search">Rechercher un participant</label>
          <input id="r-search" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={exportCsv} disabled={!bookings.length}>
          <Icon name="download" size={18} /> Exporter la liste (CSV)
        </button>
      </div>
      {shown.length ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Réservations de l'événement</caption>
            <thead>
              <tr>
                <th scope="col">Participant</th>
                <th scope="col">Places</th>
                <th scope="col">Besoins</th>
                <th scope="col">Statut</th>
                <th scope="col">Présence</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b._id}>
                  <td>
                    <strong>{b.user?.name || 'Compte supprimé'}</strong>
                    <div className="small muted">{b.user?.email} · <code>{b.reference}</code></div>
                    {b.note && <div className="small">« {b.note} »</div>}
                  </td>
                  <td>{b.seats}</td>
                  <td>{b.accessibilityNeeds?.length ? b.accessibilityNeeds.map((k) => FEATURE_LABEL[k]).join(', ') : '—'}</td>
                  <td>{b.status === 'confirmed' ? <span className="badge badge--success">Confirmée</span> : <span className="badge badge--muted">Annulée</span>}</td>
                  <td>
                    {b.status === 'confirmed' && (
                      <label className="check" style={{ minHeight: 'auto' }}>
                        <input type="checkbox" checked={b.checkedIn} onChange={(e) => checkIn(b, e.target.checked)} />
                        <span className="sr-only">Présent : {b.user?.name}</span>
                        <span aria-hidden="true">{b.checkedIn ? 'Présent' : 'Non pointé'}</span>
                      </label>
                    )}
                  </td>
                  <td>
                    {b.status === 'confirmed' && (
                      <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }} onClick={() => setCancelling(b)}>
                        Annuler<span className="sr-only"> la réservation de {b.user?.name}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="ticket" title={q ? 'Aucun participant ne correspond' : 'Aucune réservation pour le moment'} />
      )}
      <ConfirmDialog open={Boolean(cancelling)} tone="danger" title="Annuler cette réservation ?" message={cancelling ? `${cancelling.user?.name} — ${plural(cancelling.seats, 'place', 'places')}. Le participant sera notifié.` : ''} confirmLabel="Annuler la réservation" cancelLabel="Retour" busy={busy} onConfirm={cancel} onCancel={() => setCancelling(null)} />
    </OrgSpace>
  );
}

export function OrganizerStats() {
  useTitle('Statistiques');
  const { data, error, loading, reload } = useApi('/organizer/stats');
  if (error) return <OrgSpace title="Statistiques"><ErrorState error={error} onRetry={reload} /></OrgSpace>;
  if (loading) return <OrgSpace title="Statistiques"><Loading /></OrgSpace>;
  const s = data.stats;
  return (
    <OrgSpace title="Statistiques de fréquentation" intro="Calculées en temps réel à partir des réservations enregistrées.">
      <ul className="stat-grid">
        <StatCard label="Taux de remplissage global" value={percent(s.occupancyRate)} icon="chart" />
        <StatCard label="Taux de présence" value={percent(s.attendanceRate)} icon="check" tone="success" hint="Places pointées / places réservées" />
        <StatCard label="Places réservées" value={s.seatsBooked} icon="users" tone="gold" />
        <StatCard label="Annulations" value={s.cancellations} icon="close" tone="warning" />
      </ul>
      <section className="panel" aria-labelledby="occ-title" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 id="occ-title" style={{ fontSize: 'var(--fs-xl)' }}>Remplissage par événement</h2>
        <BarChart title="Taux de remplissage (%)" data={s.events.map((e) => ({ label: e.title, value: e.occupancyRate }))} format={percent} max={100} />
      </section>
      {s.events.length > 0 && (
        <div className="table-wrap">
          <table>
            <caption>Détail par événement</caption>
            <thead>
              <tr>
                <th scope="col">Événement</th>
                <th scope="col">Date</th>
                <th scope="col">Capacité</th>
                <th scope="col">Réservées</th>
                <th scope="col">Disponibles</th>
                <th scope="col">Remplissage</th>
                <th scope="col">Présents</th>
              </tr>
            </thead>
            <tbody>
              {s.events.map((e) => (
                <tr key={e.id}>
                  <th scope="row"><Link to={`/organisateur/evenements/${e.id}/reservations`}>{e.title}</Link></th>
                  <td>{formatShort(e.startDate)}</td>
                  <td>{e.capacity}</td>
                  <td>{e.seatsBooked}</td>
                  <td>{e.availableSeats}</td>
                  <td>{percent(e.occupancyRate)}</td>
                  <td>{e.checkedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OrgSpace>
  );
}
