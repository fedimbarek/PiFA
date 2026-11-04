import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, assetUrl } from '../../lib/api.js';
import { EVENT_STATUS_LABEL, formatShort, percent, ROLE_LABEL } from '../../lib/format.js';
import { Icon } from '../../components/Icon.jsx';
import { ConfirmDialog, Modal } from '../../components/Modal.jsx';
import { BarChart, StatCard } from '../../components/charts.jsx';
import { AccessibilityBadges, EmptyState, ErrorState, Loading, PageHeader, Pagination, SpaceLayout, StatusBadge, TextField } from '../../components/ui.jsx';

export const ADMIN_LINKS = [
  { to: '/admin', label: 'Tableau de bord', icon: 'grid', end: true },
  { to: '/admin/moderation', label: 'Modération', icon: 'check' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: 'users' },
  { to: '/admin/statistiques', label: 'Statistiques', icon: 'chart' },
  { to: '/admin/parametres', label: 'Paramètres', icon: 'settings' },
];

function AdminSpace({ title, intro, children }) {
  return (
    <>
      <PageHeader title={title} intro={intro} eyebrow="Administration" crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Administration', to: '/admin' }, { label: title }]} />
      <SpaceLayout title="Administration" links={ADMIN_LINKS}>
        {children}
      </SpaceLayout>
    </>
  );
}

export function AdminDashboard() {
  useTitle('Administration');
  const { data, error, loading, reload } = useApi('/admin/stats');
  const pending = useApi('/admin/events', { status: 'pending', limit: 5 });
  if (error) return <AdminSpace title="Tableau de bord"><ErrorState error={error} onRetry={reload} /></AdminSpace>;
  if (loading) return <AdminSpace title="Tableau de bord"><Loading /></AdminSpace>;
  const s = data.stats;
  return (
    <AdminSpace title="Tableau de bord" intro="Indicateurs globaux calculés à partir de la base de données.">
      <ul className="stat-grid" aria-label="Indicateurs globaux">
        <StatCard label="Utilisateurs" value={s.totalUsers} icon="users" hint={`${s.totalParticipants} participants`} />
        <StatCard label="Organisateurs" value={s.totalOrganizers} icon="heart" tone="gold" />
        <StatCard label="Événements" value={s.totalEvents} icon="calendar" hint={`${s.publishedEvents} publiés`} />
        <StatCard label="Réservations" value={s.totalReservations} icon="ticket" tone="success" hint={`${s.seatsBooked} places`} />
        <StatCard label="En attente de modération" value={s.pendingEvents} icon="clock" tone="warning" />
        <StatCard label="Remplissage moyen" value={percent(s.occupancyRate)} icon="chart" />
      </ul>
      <div className="grid-2">
        <section className="panel" aria-labelledby="mod-title">
          <div className="row-between">
            <h2 id="mod-title" style={{ fontSize: 'var(--fs-xl)' }}>À modérer</h2>
            <Link to="/admin/moderation">Tout voir</Link>
          </div>
          {pending.loading ? (
            <Loading />
          ) : pending.data?.items.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pending.data.items.map((e) => (
                <li key={e.id} style={{ padding: 'var(--sp-3) 0', borderTop: '1px solid var(--line)' }}>
                  <strong>{e.title}</strong>
                  <div className="small muted">{e.organizer?.organizationName || e.organizer?.name} · {formatShort(e.startDate)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aucun événement en attente.</p>
          )}
        </section>
        <section className="panel" aria-labelledby="top-title">
          <h2 id="top-title" style={{ fontSize: 'var(--fs-xl)' }}>Événements les plus réservés</h2>
          <BarChart title="Places réservées" data={s.topEvents.map((t) => ({ label: t.title, value: t.booked }))} />
        </section>
      </div>
    </AdminSpace>
  );
}

export function Moderation() {
  useTitle('Modération');
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/admin/events', { status: status || undefined, page, limit: 10 });
  const [preview, setPreview] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPage(1), [status]);

  const act = async (type, e, body) => {
    setBusy(true);
    try {
      const path = type === 'archive' ? `/events/${e.id}/archive` : `/admin/events/${e.id}/${type}`;
      await api.post(path, body);
      toast.success({ approve: 'Événement approuvé et publié. L’organisateur a été notifié.', reject: 'Événement refusé. L’organisateur a reçu le motif.', archive: 'Événement archivé.', restore: 'Événement remis en brouillon.' }[type]);
      setPreview(null);
      setRejecting(null);
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const submitReject = () => {
    if (reason.trim().length < 5) {
      setReasonError('Indiquez un motif d’au moins 5 caractères pour aider l’organisateur.');
      return;
    }
    act('reject', rejecting, { reason: reason.trim() });
  };

  return (
    <AdminSpace title="Modération des événements" intro="Vérifiez les informations (notamment d'accessibilité) avant publication.">
      <div className="field" style={{ maxWidth: 300, marginBottom: 'var(--sp-4)' }}>
        <label htmlFor="mod-status">Statut</label>
        <select id="mod-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous</option>
          {Object.entries(EVENT_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Loading />
      ) : data.items.length ? (
        <>
          <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
            {data.items.map((e) => (
              <li key={e.id} className="card">
                <div className="row-between">
                  <div>
                    <h2 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>{e.title}</h2>
                    <p className="small muted" style={{ margin: 0 }}>
                      {e.organizer?.organizationName || e.organizer?.name} · {e.category?.name} · {formatShort(e.startDate)} · {e.venue.city}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <div style={{ margin: 'var(--sp-3) 0' }}><AccessibilityBadges accessibility={e.accessibility} max={5} size={14} /></div>
                <div className="row">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPreview(e)}>
                    <Icon name="eye" size={16} /> Examiner<span className="sr-only"> : {e.title}</span>
                  </button>
                  {['pending', 'rejected', 'draft'].includes(e.status) && (
                    <button type="button" className="btn btn--sm" onClick={() => setConfirm({ type: 'approve', e })}>
                      <Icon name="check" size={16} /> Approuver<span className="sr-only"> : {e.title}</span>
                    </button>
                  )}
                  {['pending', 'published'].includes(e.status) && (
                    <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }} onClick={() => { setRejecting(e); setReason(''); setReasonError(''); }}>
                      Refuser<span className="sr-only"> : {e.title}</span>
                    </button>
                  )}
                  {e.status !== 'archived' && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm({ type: 'archive', e })}>
                      <Icon name="archive" size={16} /> Archiver<span className="sr-only"> : {e.title}</span>
                    </button>
                  )}
                  {e.status === 'archived' && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm({ type: 'restore', e })}>
                      Remettre en brouillon<span className="sr-only"> : {e.title}</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState icon="check" title={status === 'pending' ? 'Aucun événement en attente' : 'Aucun événement'}>Tout est à jour.</EmptyState>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title || ''} size="lg"
        footer={preview && ['pending', 'rejected', 'draft'].includes(preview.status) && (
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setRejecting(preview); setPreview(null); setReason(''); }}>Refuser</button>
            <button type="button" className="btn" disabled={busy} onClick={() => act('approve', preview)}>Approuver et publier</button>
          </>
        )}>
        {preview && (
          <div className="stack">
            {preview.coverImage?.url ? <img src={assetUrl(preview.coverImage.url)} alt={preview.coverImage.alt || ''} style={{ borderRadius: 'var(--radius)' }} /> : <p className="alert alert--warning">Pas d'image de couverture.</p>}
            {preview.coverImage?.url && !preview.coverImage.alt && <p className="alert alert--warning">L'image n'a pas de texte alternatif.</p>}
            <dl className="dl">
              <dt>Organisateur</dt><dd>{preview.organizer?.organizationName} ({preview.organizer?.email})</dd>
              <dt>Date</dt><dd>{formatShort(preview.startDate)} → {formatShort(preview.endDate)}</dd>
              <dt>Lieu</dt><dd>{preview.venue.name}, {preview.venue.address}, {preview.venue.city}</dd>
              <dt>Capacité</dt><dd>{preview.capacity} · {preview.price ? `${preview.price} TND` : 'Gratuit'}</dd>
              <dt>Carte</dt><dd>{typeof preview.venue.latitude === 'number' ? 'Coordonnées renseignées' : 'Non géolocalisé'}</dd>
            </dl>
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{preview.description}</p>
            <h3>Accessibilité</h3>
            <AccessibilityBadges accessibility={preview.accessibility} />
            {preview.venue.accessInstructions && <p><strong>Accès :</strong> {preview.venue.accessInstructions}</p>}
            {preview.accessibilityNotes && <p><strong>Précisions :</strong> {preview.accessibilityNotes}</p>}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Refuser l'événement" description={rejecting ? `« ${rejecting.title} » — le motif sera transmis à l'organisateur.` : ''}
        footer={<>
          <button type="button" className="btn btn--secondary" onClick={() => setRejecting(null)}>Annuler</button>
          <button type="button" className="btn btn--danger" disabled={busy} onClick={submitReject}>Confirmer le refus</button>
        </>}>
        <TextField id="reject-reason" as="textarea" rows={4} label="Motif du refus" required value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(''); }} error={reasonError} hint="ex. merci de préciser l'accès PMR et les horaires d'interprétation." />
      </Modal>

      {confirm && (
        <ConfirmDialog open title={{ approve: 'Approuver et publier ?', archive: 'Archiver cet événement ?', restore: 'Remettre en brouillon ?' }[confirm.type]} message={`« ${confirm.e.title} »${confirm.type === 'archive' ? ' — les réservations futures seront annulées et les participants prévenus.' : ''}`} confirmLabel={{ approve: 'Approuver', archive: 'Archiver', restore: 'Confirmer' }[confirm.type]} tone={confirm.type === 'archive' ? 'danger' : 'primary'} busy={busy} onConfirm={() => act(confirm.type, confirm.e)} onCancel={() => setConfirm(null)} />
      )}
    </AdminSpace>
  );
}

export function Users() {
  useTitle('Utilisateurs');
  const { user: me } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/admin/users', { ...applied, page, limit: 20 });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (confirm.type === 'delete') await api.del(`/admin/users/${confirm.u.id}`);
      else await api.patch(`/admin/users/${confirm.u.id}`, confirm.body);
      toast.success(confirm.done);
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSpace title="Gestion des utilisateurs" intro="Participants, organisateurs et administrateurs.">
      <form className="card row" style={{ alignItems: 'flex-end', marginBottom: 'var(--sp-4)' }} onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }} role="search" aria-label="Filtrer les utilisateurs">
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="u-q">Nom, e-mail ou association</label>
          <input id="u-q" className="input" type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label htmlFor="u-role">Rôle</label>
          <select id="u-role" className="select" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
            <option value="">Tous</option>
            {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label htmlFor="u-status">Statut</label>
          <select id="u-status" className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>
        <button type="submit" className="btn">Filtrer</button>
      </form>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Loading />
      ) : data.items.length ? (
        <>
          <p className="muted" role="status">{data.total} compte(s)</p>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Utilisateurs</caption>
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Inscription</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>{self && <span className="badge badge--gold" style={{ marginLeft: 6 }}>Vous</span>}
                        <div className="small muted">{u.email}{u.organizationName ? ` · ${u.organizationName}` : ''}</div>
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Rôle de {u.name}</label>
                        <select id={`role-${u.id}`} className="select" value={u.role} disabled={self} style={{ minWidth: 160 }}
                          onChange={(e) => setConfirm({ type: 'role', u, body: { role: e.target.value }, title: 'Changer le rôle ?', msg: `${u.name} deviendra ${ROLE_LABEL[e.target.value].toLowerCase()}.`, done: 'Rôle mis à jour.' })}>
                          {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </td>
                      <td>{u.status === 'active' ? <span className="badge badge--success">Actif</span> : <span className="badge badge--danger">Suspendu</span>}</td>
                      <td>{formatShort(u.createdAt)}</td>
                      <td>
                        {!self && (
                          <div className="row" style={{ gap: 4 }}>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm({ type: 'status', u, body: { status: u.status === 'active' ? 'suspended' : 'active' }, title: u.status === 'active' ? 'Suspendre ce compte ?' : 'Réactiver ce compte ?', msg: u.status === 'active' ? `${u.name} ne pourra plus se connecter.` : `${u.name} pourra de nouveau se connecter.`, done: 'Statut mis à jour.' })}>
                              {u.status === 'active' ? 'Suspendre' : 'Réactiver'}<span className="sr-only"> : {u.name}</span>
                            </button>
                            <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }} onClick={() => setConfirm({ type: 'delete', u, title: 'Supprimer ce compte ?', msg: `Le compte de ${u.name} sera supprimé définitivement.`, done: 'Compte supprimé.' })}>
                              <Icon name="trash" size={16} /> Supprimer<span className="sr-only"> : {u.name}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState icon="users" title="Aucun utilisateur ne correspond" />
      )}
      {confirm && <ConfirmDialog open title={confirm.title} message={confirm.msg} tone={confirm.type === 'delete' || confirm.body?.status === 'suspended' ? 'danger' : 'primary'} busy={busy} onConfirm={run} onCancel={() => setConfirm(null)} />}
    </AdminSpace>
  );
}

export function AdminStats() {
  useTitle('Statistiques globales');
  const { data, error, loading, reload } = useApi('/admin/stats');
  if (error) return <AdminSpace title="Statistiques"><ErrorState error={error} onRetry={reload} /></AdminSpace>;
  if (loading) return <AdminSpace title="Statistiques"><Loading /></AdminSpace>;
  const s = data.stats;
  return (
    <AdminSpace title="Statistiques de la plateforme" intro="Toutes les valeurs sont agrégées depuis MongoDB au moment de l'affichage.">
      <ul className="stat-grid">
        <StatCard label="Événements à venir" value={s.upcomingEvents} icon="calendar" />
        <StatCard label="Refusés" value={s.rejectedEvents} icon="close" tone="warning" />
        <StatCard label="Archivés" value={s.archivedEvents} icon="archive" />
        <StatCard label="Annulations" value={s.cancelledReservations} icon="close" tone="warning" />
        <StatCard label="Comptes suspendus" value={s.suspendedUsers} icon="shield" />
      </ul>
      <div className="grid-2">
        <section className="panel" aria-labelledby="cat-title">
          <h2 id="cat-title" style={{ fontSize: 'var(--fs-xl)' }}>Réservations par catégorie</h2>
          <BarChart title="Places réservées par catégorie" data={s.reservationsByCategory.map((r) => ({ label: r.category, value: r.seats }))} />
        </section>
        <section className="panel" aria-labelledby="cov-title">
          <h2 id="cov-title" style={{ fontSize: 'var(--fs-xl)' }}>Couverture des services d'accessibilité</h2>
          <BarChart title="Part des événements publiés proposant chaque service" data={s.accessibilityCoverage.map((r) => ({ label: r.label, value: r.rate }))} format={percent} max={100} />
        </section>
      </div>
      <section className="panel" aria-labelledby="days-title" style={{ marginTop: 'var(--sp-5)' }}>
        <h2 id="days-title" style={{ fontSize: 'var(--fs-xl)' }}>Réservations des 30 derniers jours</h2>
        {s.reservationsLast30Days.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Réservations par jour</caption>
              <thead><tr><th scope="col">Jour</th><th scope="col">Confirmées</th><th scope="col">Annulées</th></tr></thead>
              <tbody>
                {s.reservationsLast30Days.map((d) => <tr key={d.date}><th scope="row">{new Date(d.date).toLocaleDateString('fr-FR')}</th><td>{d.confirmed}</td><td>{d.cancelled}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Aucune réservation sur la période.</p>}
      </section>
    </AdminSpace>
  );
}

export function AdminSettings() {
  useTitle('Paramètres');
  const toast = useToast();
  const settings = useApi('/admin/settings');
  const cats = useApi('/categories', { all: 'true' });
  const messages = useApi('/admin/contact-messages');
  const [draft, setDraft] = useState(null);
  const [newCat, setNewCat] = useState({ name: '', description: '' });
  const [catError, setCatError] = useState('');
  const [deleting, setDeleting] = useState(null);
  useEffect(() => {
    if (settings.data) setDraft(settings.data.settings);
  }, [settings.data]);

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      const { requireModeration, maxSeatsPerBooking, cancellationDeadlineHours, allowOrganizerSignup, maintenanceMessage } = draft;
      await api.put('/admin/settings', { requireModeration, maxSeatsPerBooking: Number(maxSeatsPerBooking), cancellationDeadlineHours: Number(cancellationDeadlineHours), allowOrganizerSignup, maintenanceMessage });
      toast.success('Paramètres enregistrés.');
      settings.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const addCat = async (e) => {
    e.preventDefault();
    if (newCat.name.trim().length < 2) return setCatError('Le nom doit contenir au moins 2 caractères.');
    try {
      await api.post('/categories', { name: newCat.name.trim(), description: newCat.description.trim() || undefined });
      toast.success('Catégorie ajoutée.');
      setNewCat({ name: '', description: '' });
      setCatError('');
      cats.reload();
    } catch (err) {
      setCatError(err.message);
    }
  };
  const toggleCat = async (c) => {
    await api.patch(`/categories/${c._id}`, { active: !c.active }).then(() => cats.reload()).catch((err) => toast.error(err.message));
  };
  const deleteCat = async () => {
    try {
      await api.del(`/categories/${deleting._id}`);
      toast.success('Catégorie supprimée.');
      cats.reload();
    } catch (err) {
      toast.error(err.message);
    }
    setDeleting(null);
  };
  const handled = async (m) => {
    await api.patch(`/admin/contact-messages/${m._id}/handled`);
    messages.reload();
  };

  return (
    <AdminSpace title="Paramètres de la plateforme" intro="Règles de modération et de réservation, catégories et messages reçus.">
      <div className="stack">
        {draft ? (
          <form className="panel form" onSubmit={saveSettings} aria-labelledby="set-title">
            <h2 id="set-title" style={{ fontSize: 'var(--fs-xl)' }}>Règles</h2>
            <label className="check"><input type="checkbox" checked={draft.requireModeration} onChange={(e) => setDraft({ ...draft, requireModeration: e.target.checked })} /> <span>Modération obligatoire avant publication<span className="hint" style={{ display: 'block' }}>Désactivé : les événements des organisateurs sont publiés directement.</span></span></label>
            <label className="check"><input type="checkbox" checked={draft.allowOrganizerSignup} onChange={(e) => setDraft({ ...draft, allowOrganizerSignup: e.target.checked })} /> Autoriser l'inscription de nouveaux organisateurs</label>
            <div className="form-grid">
              <TextField id="s-max" type="number" min={1} max={10} label="Places maximum par réservation" value={draft.maxSeatsPerBooking} onChange={(e) => setDraft({ ...draft, maxSeatsPerBooking: e.target.value })} />
              <TextField id="s-deadline" type="number" min={0} max={168} label="Délai d'annulation (heures avant l'événement)" value={draft.cancellationDeadlineHours} onChange={(e) => setDraft({ ...draft, cancellationDeadlineHours: e.target.value })} />
            </div>
            <div><button className="btn" type="submit">Enregistrer les règles</button></div>
          </form>
        ) : settings.error ? <ErrorState error={settings.error} /> : <Loading />}

        <section className="panel" aria-labelledby="cats-title">
          <h2 id="cats-title" style={{ fontSize: 'var(--fs-xl)' }}>Catégories</h2>
          <form className="row" style={{ alignItems: 'flex-end', marginBottom: 'var(--sp-4)' }} onSubmit={addCat} noValidate>
            <div style={{ flex: '1 1 200px' }}><TextField id="c-name" label="Nouvelle catégorie" required value={newCat.name} error={catError} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} /></div>
            <div style={{ flex: '2 1 260px' }}><TextField id="c-desc" label="Description" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} /></div>
            <button className="btn" type="submit"><Icon name="plus" /> Ajouter</button>
          </form>
          {cats.data && (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Catégories</caption>
                <thead><tr><th scope="col">Nom</th><th scope="col">Description</th><th scope="col">État</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {cats.data.categories.map((c) => (
                    <tr key={c._id}>
                      <th scope="row">{c.name}</th>
                      <td>{c.description}</td>
                      <td>{c.active ? <span className="badge badge--success">Active</span> : <span className="badge badge--muted">Désactivée</span>}</td>
                      <td>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleCat(c)}>{c.active ? 'Désactiver' : 'Activer'}<span className="sr-only"> : {c.name}</span></button>
                        <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }} onClick={() => setDeleting(c)}>Supprimer<span className="sr-only"> : {c.name}</span></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="msg-title">
          <h2 id="msg-title" style={{ fontSize: 'var(--fs-xl)' }}>Messages de contact</h2>
          {messages.data?.items.length ? (
            <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
              {messages.data.items.map((m) => (
                <li key={m._id} className="card">
                  <div className="row-between">
                    <h3 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>{m.subject}</h3>
                    {m.handled ? <span className="badge badge--success">Traité</span> : <span className="badge badge--warning">À traiter</span>}
                  </div>
                  <p className="small muted">{m.name} — <a href={`mailto:${m.email}`}>{m.email}</a> — {formatShort(m.createdAt)}</p>
                  <p style={{ whiteSpace: 'pre-line' }}>{m.message}</p>
                  {!m.handled && <button type="button" className="btn btn--secondary btn--sm" onClick={() => handled(m)}>Marquer comme traité<span className="sr-only"> : {m.subject}</span></button>}
                </li>
              ))}
            </ul>
          ) : <p className="muted">Aucun message.</p>}
        </section>
      </div>
      <ConfirmDialog open={Boolean(deleting)} tone="danger" title="Supprimer la catégorie ?" message={deleting ? `« ${deleting.name} ». Impossible si des événements l'utilisent (désactivez-la alors).` : ''} confirmLabel="Supprimer" onConfirm={deleteCat} onCancel={() => setDeleting(null)} />
    </AdminSpace>
  );
}
