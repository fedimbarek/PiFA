import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { EventCard, EventCardSkeleton } from '../../components/EventCard.jsx';
import { Icon } from '../../components/Icon.jsx';
import { EmptyState, ErrorState, PageHeader, Pagination } from '../../components/ui.jsx';
import { ACCESSIBILITY_FEATURES, plural } from '../../lib/format.js';

const FILTER_KEYS = ['q', 'category', 'city', 'from', 'to', 'free', 'features', 'available', 'sort'];
const SORTS = [
  ['date', 'Date (plus proches d’abord)'],
  ['-date', 'Date (plus lointaines d’abord)'],
  ['price', 'Prix croissant'],
  ['-price', 'Prix décroissant'],
  ['recent', 'Récemment publiés'],
  ['relevance', 'Pertinence (avec recherche)'],
];

const fromParams = (sp) => ({
  q: sp.get('q') || '',
  category: sp.get('category') || '',
  city: sp.get('city') || '',
  from: sp.get('from') || '',
  to: sp.get('to') || '',
  free: sp.get('free') || '',
  features: (sp.get('features') || '').split(',').filter(Boolean),
  available: sp.get('available') === 'true',
  sort: sp.get('sort') || 'date',
});

export default function Events() {
  useTitle('Événements');
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get('page') || 1);
  const applied = useMemo(() => fromParams(sp), [sp]);
  const [form, setForm] = useState(applied);
  const { prefs } = usePreferences();
  useEffect(() => setForm(applied), [applied]);

  const query = { ...applied, features: applied.features.join(','), available: applied.available ? 'true' : '', page, limit: 12 };
  const { data, error, loading, reload } = useApi('/events', query);
  const { data: cats } = useApi('/categories');
  const { data: cities } = useApi('/meta/cities');

  const apply = (next, resetPage = true) => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = next[k];
      if (k === 'features' ? v.length : k === 'available' ? v : v && !(k === 'sort' && v === 'date')) p.set(k, k === 'features' ? v.join(',') : String(v));
    }
    if (!resetPage && page > 1) p.set('page', String(page));
    setSp(p);
  };
  const onSubmit = (e) => {
    e.preventDefault();
    apply(form);
  };
  const toggleFeature = (k) => setForm((f) => ({ ...f, features: f.features.includes(k) ? f.features.filter((x) => x !== k) : [...f.features, k] }));
  const activeCount = FILTER_KEYS.filter((k) => (k === 'features' ? applied.features.length : k === 'sort' ? false : applied[k])).length;

  return (
    <>
      <PageHeader
        title="Événements accessibles"
        eyebrow="Agenda"
        intro="Filtrez par date, lieu, gratuité et services d'accessibilité pour trouver l'événement qui vous convient."
        crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Événements' }]}
      />
      <div className="container list-layout">
        <aside aria-labelledby="filters-title">
          <form className="card form" onSubmit={onSubmit} aria-describedby="filters-help">
            <div className="row-between">
              <h2 id="filters-title" style={{ fontSize: 'var(--fs-xl)', margin: 0 }}>
                <Icon name="filter" /> Filtres
              </h2>
              {activeCount > 0 && <span className="badge badge--gold">{plural(activeCount, 'actif', 'actifs')}</span>}
            </div>
            <p id="filters-help" className="hint">Choisissez vos critères puis validez avec « Afficher les résultats ».</p>
            <div className="field">
              <label htmlFor="f-q">Mots-clés</label>
              <input id="f-q" className="input" type="search" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder="ex. théâtre, calligraphie" />
            </div>
            <div className="field">
              <label htmlFor="f-cat">Catégorie</label>
              <select id="f-cat" className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Toutes les catégories</option>
                {cats?.categories?.map((c) => (
                  <option key={c._id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-city">Ville</label>
              <select id="f-city" className="select" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                <option value="">Toutes les villes</option>
                {cities?.cities?.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend>Dates</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="f-from">À partir du</label>
                  <input id="f-from" className="input" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="f-to">Jusqu’au</label>
                  <input id="f-to" className="input" type="date" value={form.to} min={form.from || undefined} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Tarif</legend>
              {[
                ['', 'Tous'],
                ['true', 'Gratuit'],
                ['false', 'Payant'],
              ].map(([v, l]) => (
                <label key={v || 'all'} className="check">
                  <input type="radio" name="free" value={v} checked={form.free === v} onChange={() => setForm({ ...form, free: v })} /> {l}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Services d&rsquo;accessibilité requis</legend>
              {prefs.preferredFeatures?.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setForm({ ...form, features: prefs.preferredFeatures })}>
                  Utiliser mes besoins enregistrés
                </button>
              )}
              {ACCESSIBILITY_FEATURES.map((f) => (
                <label key={f.key} className="check">
                  <input type="checkbox" checked={form.features.includes(f.key)} onChange={() => toggleFeature(f.key)} />
                  <span>{f.label}</span>
                </label>
              ))}
            </fieldset>
            <label className="check">
              <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
              <span>Uniquement avec des places disponibles</span>
            </label>
            <div className="field">
              <label htmlFor="f-sort">Trier par</label>
              <select id="f-sort" className="select" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })}>
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn--block">
              Afficher les résultats
            </button>
            {activeCount > 0 && (
              <button type="button" className="btn btn--ghost btn--block" onClick={() => apply({ ...fromParams(new URLSearchParams()) })}>
                Effacer tous les filtres
              </button>
            )}
          </form>
        </aside>

        <section aria-labelledby="results-title" style={{ minWidth: 0 }}>
          <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
            <h2 id="results-title" tabIndex={-1} style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>
              Résultats
            </h2>
            <p role="status" aria-live="polite" className="muted" style={{ margin: 0 }}>
              {loading ? 'Recherche en cours…' : data ? `${plural(data.total, 'événement trouvé', 'événements trouvés')}${data.pages > 1 ? ` — page ${data.page} sur ${data.pages}` : ''}` : ''}
            </p>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading && !data ? (
            <div className="card-grid" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : data?.items.length ? (
            <>
              <ul className="card-grid" aria-busy={loading}>
                {data.items.map((e, i) => (
                  <li key={e.id}>
                    <EventCard event={e} eager={i < 2} />
                  </li>
                ))}
              </ul>
              <Pagination
                page={data.page}
                pages={data.pages}
                onChange={(n) => {
                  const p = new URLSearchParams(sp);
                  p.set('page', String(n));
                  setSp(p);
                  document.getElementById('results-title')?.focus();
                }}
              />
            </>
          ) : (
            <EmptyState
              title="Aucun événement ne correspond à ces critères"
              action={
                <button type="button" className="btn btn--secondary" onClick={() => apply(fromParams(new URLSearchParams()))}>
                  Effacer les filtres
                </button>
              }
            >
              Essayez d&rsquo;élargir les dates, de retirer un service d&rsquo;accessibilité ou de changer de ville.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
