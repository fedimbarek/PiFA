import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, download } from '../../lib/api.js';
import { ACCESSIBILITY_FEATURES, FEATURE_LABEL, formatDateTime, formatShort, plural, ROLE_LABEL } from '../../lib/format.js';
import { changePasswordSchema, profileSchema } from '../../lib/validation.js';
import { Icon } from '../../components/Icon.jsx';
import { ConfirmDialog } from '../../components/Modal.jsx';
import { StatCard } from '../../components/charts.jsx';
import { applyServerErrors, EmptyState, ErrorState, Loading, PageHeader, Pagination, SpaceLayout, TextField } from '../../components/ui.jsx';

export const USER_LINKS = [
  { to: '/mon-espace', label: 'Tableau de bord', icon: 'home', end: true },
  { to: '/mon-espace/reservations', label: 'Mes réservations', icon: 'ticket' },
  { to: '/mon-espace/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/mon-espace/profil', label: 'Mon profil', icon: 'user' },
  { to: '/mon-espace/accessibilite', label: 'Accessibilité', icon: 'eye' },
];

function UserSpace({ title, intro, children }) {
  return (
    <>
      <PageHeader title={title} intro={intro} eyebrow="Mon espace" crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Mon espace', to: '/mon-espace' }, { label: title }]} />
      <SpaceLayout title="Mon espace" links={USER_LINKS}>
        {children}
      </SpaceLayout>
    </>
  );
}

const isUpcoming = (b) => b.status === 'confirmed' && b.event && new Date(b.event.startDate) > new Date();

export function UserDashboard() {
  const { user, unread } = useAuth();
  useTitle('Mon espace');
  const { data, error, loading, reload } = useApi('/bookings/me', { limit: 100 });
  const upcoming = (data?.items || []).filter(isUpcoming).sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate));
  const past = (data?.items || []).filter((b) => b.status === 'confirmed' && b.event && new Date(b.event.startDate) <= new Date());
  return (
    <UserSpace title={`Bonjour ${user.name.split(' ')[0]}`} intro={`Compte ${ROLE_LABEL[user.role].toLowerCase()} — retrouvez vos réservations et vos préférences.`}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Loading />
      ) : (
        <>
          <ul className="stat-grid">
            <StatCard label="Réservations à venir" value={upcoming.length} icon="ticket" />
            <StatCard label="Événements passés" value={past.length} icon="clock" tone="gold" />
            <StatCard label="Notifications non lues" value={unread} icon="bell" tone="warning" />
          </ul>
          <section className="panel" aria-labelledby="next-title">
            <div className="row-between">
              <h2 id="next-title" style={{ fontSize: 'var(--fs-xl)' }}>Mes prochains événements</h2>
              {upcoming.length > 0 && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => download('/bookings/me/calendar.ics', 'inclusivenue-reservations.ics')}>
                  <Icon name="download" size={18} /> Exporter vers mon agenda (iCal)
                </button>
              )}
            </div>
            {upcoming.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcoming.slice(0, 5).map((b) => (
                  <li key={b._id} className="row-between" style={{ padding: 'var(--sp-3) 0', borderTop: '1px solid var(--line)' }}>
                    <div>
                      <Link to={`/evenements/${b.event._id}`}><strong>{b.event.title}</strong></Link>
                      <div className="small muted">{formatDateTime(b.event.startDate)} — {b.event.venue?.city}</div>
                    </div>
                    <span className="badge">{plural(b.seats, 'place', 'places')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="calendar" title="Aucune réservation à venir" action={<Link to="/evenements" className="btn">Trouver un événement</Link>} />
            )}
          </section>
          {!user.preferences?.preferredFeatures?.length && (
            <div className="alert alert--info" style={{ marginTop: 'var(--sp-5)' }}>
              <Icon name="info" />
              <p style={{ margin: 0 }}>
                Indiquez vos besoins d&rsquo;accessibilité pour qu&rsquo;ils soient pré-remplis lors de vos réservations : <Link to="/mon-espace/accessibilite">configurer mes préférences</Link>.
              </p>
            </div>
          )}
        </>
      )}
    </UserSpace>
  );
}

export function Bookings() {
  useTitle('Mes réservations');
  const toast = useToast();
  const { refreshUnread } = useAuth();
  const [tab, setTab] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi('/bookings/me', { limit: 100, page });

  const items = data?.items || [];
  const lists = {
    upcoming: items.filter(isUpcoming),
    past: items.filter((b) => b.status === 'confirmed' && b.event && new Date(b.event.startDate) <= new Date()),
    cancelled: items.filter((b) => b.status === 'cancelled'),
  };
  const tabs = [
    ['upcoming', 'À venir'],
    ['past', 'Passées'],
    ['cancelled', 'Annulées'],
  ];

  const doCancel = async () => {
    setBusy(true);
    try {
      await api.post(`/bookings/${cancelling._id}/cancel`);
      toast.success(`Réservation ${cancelling.reference} annulée. Les places ont été libérées.`);
      setCancelling(null);
      refreshUnread();
      reload();
    } catch (e) {
      toast.error(e.message);
      setCancelling(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UserSpace title="Mes réservations" intro="Historique complet, annulation et export vers votre agenda.">
      <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="tabs" role="tablist" aria-label="Filtrer les réservations" style={{ marginBottom: 0, borderBottom: 0 }}>
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="bookings-panel" tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}
              onKeyDown={(e) => {
                const i = tabs.findIndex(([x]) => x === k);
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0];
                  setTab(n);
                  document.getElementById(`tab-${n}`)?.focus();
                }
              }}>
              {l} ({lists[k].length})
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => download('/bookings/me/calendar.ics', 'inclusivenue-reservations.ics').catch((e) => toast.error(e.message))}>
          <Icon name="calendar" size={18} /> Tout exporter (iCal)
        </button>
      </div>
      <div id="bookings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <Loading />
        ) : lists[tab].length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Réservations {tabs.find(([k]) => k === tab)[1].toLowerCase()}</caption>
              <thead>
                <tr>
                  <th scope="col">Événement</th>
                  <th scope="col">Date</th>
                  <th scope="col">Places</th>
                  <th scope="col">Référence</th>
                  <th scope="col">Besoins signalés</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {lists[tab].map((b) => (
                  <tr key={b._id}>
                    <td>{b.event ? <Link to={`/evenements/${b.event._id}`}>{b.event.title}</Link> : 'Événement supprimé'}</td>
                    <td>{b.event ? formatShort(b.event.startDate) : '—'}</td>
                    <td>{b.seats}</td>
                    <td><code>{b.reference}</code></td>
                    <td>{b.accessibilityNeeds?.length ? b.accessibilityNeeds.map((k) => FEATURE_LABEL[k]).join(', ') : '—'}</td>
                    <td>
                      {tab === 'upcoming' && (
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => download(`/bookings/${b._id}/calendar.ics`, `reservation-${b.reference}.ics`).catch((e) => toast.error(e.message))}>
                            <Icon name="calendar" size={18} /> iCal<span className="sr-only"> : {b.event.title}</span>
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }} onClick={() => setCancelling(b)}>
                            Annuler<span className="sr-only"> la réservation {b.reference}</span>
                          </button>
                        </div>
                      )}
                      {tab === 'cancelled' && <span className="small muted">{b.cancelledBy === 'user' ? 'Annulée par vous' : "Annulée par l'organisateur"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="ticket" title="Aucune réservation dans cette catégorie" action={tab === 'upcoming' ? <Link to="/evenements" className="btn">Découvrir les événements</Link> : null} />
        )}
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
      </div>
      <ConfirmDialog
        open={Boolean(cancelling)}
        tone="danger"
        title="Annuler cette réservation ?"
        message={cancelling ? `${cancelling.event?.title} — ${plural(cancelling.seats, 'place', 'places')}. Cette action est définitive.` : ''}
        confirmLabel="Oui, annuler la réservation"
        cancelLabel="Non, la conserver"
        busy={busy}
        onConfirm={doCancel}
        onCancel={() => setCancelling(null)}
      />
    </UserSpace>
  );
}

export function Notifications() {
  useTitle('Notifications');
  const { setUnread } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { data, error, loading, reload } = useApi('/notifications', { page, limit: 20, unread: onlyUnread ? 'true' : undefined });

  const markRead = async (n) => {
    await api.patch(`/notifications/${n._id}/read`);
    reload();
    setUnread((u) => Math.max(0, u - 1));
  };
  const markAll = async () => {
    await api.post('/notifications/read-all');
    setUnread(0);
    toast.success('Toutes les notifications sont marquées comme lues.');
    reload();
  };
  const remove = async (n) => {
    await api.del(`/notifications/${n._id}`);
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    toast.notify('Notification supprimée.');
    reload();
  };
  const emailText = { sent: 'E-mail envoyé', logged: 'E-mail non envoyé (mode développement)', disabled: 'E-mails désactivés dans vos préférences', failed: "Échec de l'envoi de l'e-mail" };

  return (
    <UserSpace title="Notifications" intro="Confirmations, annulations, rappels et décisions de modération.">
      <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
        <label className="check">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => { setOnlyUnread(e.target.checked); setPage(1); }} /> Afficher uniquement les non lues
        </label>
        {data?.unread > 0 && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={markAll}>
            <Icon name="check" size={18} /> Tout marquer comme lu
          </button>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : data.items.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {data.items.map((n) => (
            <li key={n._id} className="card" style={{ borderLeft: n.read ? undefined : '5px solid var(--gold-400)' }}>
              <div className="row-between">
                <h2 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>
                  {!n.read && <span className="sr-only">Non lue : </span>}
                  {n.title}
                </h2>
                <span className="small muted">{formatShort(n.createdAt)}</span>
              </div>
              <p style={{ margin: 'var(--sp-2) 0' }}>{n.message}</p>
              <div className="row">
                {n.link && <Link to={n.link} className="btn btn--ghost btn--sm">Voir le détail</Link>}
                {!n.read && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => markRead(n)}>
                    Marquer comme lue<span className="sr-only"> : {n.title}</span>
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(n)}>
                  <Icon name="trash" size={16} /> Supprimer<span className="sr-only"> : {n.title}</span>
                </button>
                {n.emailStatus && n.emailStatus !== 'none' && <span className="small muted">{emailText[n.emailStatus]}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="bell" title={onlyUnread ? 'Aucune notification non lue' : 'Aucune notification'}>Vous serez prévenu(e) ici de vos confirmations et rappels.</EmptyState>
      )}
      <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
    </UserSpace>
  );
}

export function Profile() {
  useTitle('Mon profil');
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone, city: user.city, organizationName: user.organizationName, bio: user.bio },
  });
  const pw = useForm({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (v) => {
    try {
      const body = { ...v };
      if (user.role === 'user') delete body.organizationName;
      const r = await api.patch('/users/me', body);
      setUser((u) => ({ ...u, ...r.user }));
      toast.success('Profil mis à jour.');
    } catch (e) {
      applyServerErrors(e, setError);
      toast.error(e.message);
    }
  };
  const onPassword = async ({ currentPassword, newPassword }) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Mot de passe modifié. Veuillez vous reconnecter.');
      await logout();
    } catch (e) {
      pw.setError('currentPassword', { message: e.message });
    }
  };

  return (
    <UserSpace title="Mon profil" intro="Informations personnelles et sécurité du compte.">
      <div className="stack">
        <form className="panel form" noValidate onSubmit={handleSubmit(onSubmit)} aria-labelledby="profile-title">
          <h2 id="profile-title" style={{ fontSize: 'var(--fs-xl)' }}>Informations personnelles</h2>
          <div className="form-grid">
            <TextField id="f-name" label="Nom complet" required autoComplete="name" error={errors.name?.message} {...register('name')} />
            <TextField id="f-email" label="Adresse e-mail" value={user.email} readOnly hint="Contactez-nous pour la modifier." />
            <TextField id="f-phone" label="Téléphone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
            <TextField id="f-city" label="Ville" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
          </div>
          {user.role !== 'user' && <TextField id="f-org" label="Association / structure" error={errors.organizationName?.message} {...register('organizationName')} />}
          <TextField id="f-bio" as="textarea" label="Présentation (facultatif)" rows={3} error={errors.bio?.message} {...register('bio')} />
          <div>
            <button type="submit" className="btn" disabled={isSubmitting || !isDirty}>
              Enregistrer les modifications
            </button>
          </div>
        </form>
        <form className="panel form" noValidate onSubmit={pw.handleSubmit(onPassword)} aria-labelledby="pw-title">
          <h2 id="pw-title" style={{ fontSize: 'var(--fs-xl)' }}>Changer de mot de passe</h2>
          <div className="form-grid">
            <TextField id="f-current" label="Mot de passe actuel" type="password" autoComplete="current-password" required error={pw.formState.errors.currentPassword?.message} {...pw.register('currentPassword')} />
            <TextField id="f-new" label="Nouveau mot de passe" type="password" autoComplete="new-password" required hint="8 caractères, majuscule, minuscule, chiffre." error={pw.formState.errors.newPassword?.message} {...pw.register('newPassword')} />
            <TextField id="f-confirm" label="Confirmer" type="password" autoComplete="new-password" required error={pw.formState.errors.confirm?.message} {...pw.register('confirm')} />
          </div>
          <div>
            <button type="submit" className="btn btn--secondary" disabled={pw.formState.isSubmitting}>
              Modifier le mot de passe
            </button>
          </div>
        </form>
      </div>
    </UserSpace>
  );
}

export function AccessibilitySettings() {
  useTitle("Réglages d'accessibilité");
  const { prefs, update, reset } = usePreferences();
  const toast = useToast();
  const [draft, setDraft] = useState(prefs);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await update(draft);
      toast.success('Préférences enregistrées sur votre compte. Elles s’appliqueront à chaque connexion.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  const toggles = [
    ['highContrast', 'Contraste élevé', 'Texte noir sur fond blanc, contours renforcés.'],
    ['reducedMotion', 'Réduire les animations', 'Désactive les transitions, défilements animés et effets de survol.'],
    ['dyslexiaFont', 'Lecture facilitée (dyslexie, troubles cognitifs)', 'Augmente l’espacement des lettres, des mots et des lignes ; limite la largeur des paragraphes.'],
    ['underlineLinks', 'Souligner tous les liens', null],
    ['screenReaderMode', 'Mode lecteur d’écran', 'Masque les illustrations décoratives et affiche les listes sur une seule colonne.'],
    ['hearingMode', 'Mode sourd / malentendant', 'Alertes visuelles renforcées ; vos besoins « langue des signes » et « sous-titrage » sont proposés par défaut.'],
    ['emailNotifications', 'Recevoir les notifications par e-mail', 'Confirmations, annulations et rappels.'],
  ];

  return (
    <UserSpace title="Réglages d'accessibilité" intro="Adaptez l'affichage et indiquez vos besoins. Vos choix sont enregistrés sur votre compte.">
      <form className="panel form" onSubmit={save} aria-labelledby="a11y-form-title">
        <h2 id="a11y-form-title" style={{ fontSize: 'var(--fs-xl)' }}>Affichage</h2>
        <div className="field">
          <label htmlFor="fontScale">Taille du texte</label>
          <select id="fontScale" className="select" value={draft.fontScale} onChange={(e) => set('fontScale', Number(e.target.value))} style={{ maxWidth: 260 }}>
            {[100, 112, 125, 150, 175, 200].map((s) => (
              <option key={s} value={s}>
                {s} %{s === 100 ? ' (par défaut)' : ''}
              </option>
            ))}
          </select>
        </div>
        {toggles.map(([k, label, hint]) => (
          <label key={k} className="check">
            <input
              type="checkbox"
              checked={Boolean(draft[k])}
              onChange={(e) => {
                set(k, e.target.checked);
                if (k === 'hearingMode' && e.target.checked) setDraft((d) => ({ ...d, hearingMode: true, preferredFeatures: [...new Set([...(d.preferredFeatures || []), 'signLanguage', 'subtitles'])] }));
              }}
            />
            <span>
              {label}
              {hint && <span className="hint" style={{ display: 'block' }}>{hint}</span>}
            </span>
          </label>
        ))}
        <fieldset>
          <legend>Mes besoins lors des événements</legend>
          <p className="hint">Ils seront pré-sélectionnés dans les filtres et lors de vos réservations.</p>
          <div className="check-grid">
            {ACCESSIBILITY_FEATURES.map((f) => (
              <label key={f.key} className="check">
                <input
                  type="checkbox"
                  checked={draft.preferredFeatures?.includes(f.key) || false}
                  onChange={(e) => set('preferredFeatures', e.target.checked ? [...(draft.preferredFeatures || []), f.key] : draft.preferredFeatures.filter((x) => x !== f.key))}
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextField id="otherNeeds" as="textarea" label="Autres besoins (facultatif)" hint="ex. besoin d'un accompagnateur, d'une place près de la sortie…" rows={3} maxLength={500} value={draft.otherNeeds || ''} onChange={(e) => set('otherNeeds', e.target.value)} />
        <div className="row">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer mes préférences'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={async () => { await reset(); setDraft({ ...prefs, fontScale: 100, highContrast: false, reducedMotion: false, dyslexiaFont: false, underlineLinks: false, screenReaderMode: false, hearingMode: false, preferredFeatures: [], otherNeeds: '', emailNotifications: true }); toast.notify('Préférences réinitialisées.'); }}>
            Réinitialiser
          </button>
        </div>
      </form>
    </UserSpace>
  );
}
