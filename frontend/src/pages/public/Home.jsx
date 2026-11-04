import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { EventCard, EventCardSkeleton } from '../../components/EventCard.jsx';
import { Icon } from '../../components/Icon.jsx';
import { ErrorState, EmptyState } from '../../components/ui.jsx';
import { ACCESSIBILITY_FEATURES } from '../../lib/format.js';
import styles from './Home.module.css';

const QUICK = ['wheelchair', 'signLanguage', 'hearingLoop', 'audioDescription', 'adaptedTransport', 'quietSpace'];

export default function Home() {
  useTitle(null);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useApi('/events', { limit: 6, sort: 'date' });
  const { data: cats } = useApi('/categories');

  const submit = (e) => {
    e.preventDefault();
    navigate(`/evenements${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <>
      <section className={`${styles.hero} on-dark`} aria-labelledby="hero-title">
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <span className={styles.kicker}>
              <Icon name="sparkle" size={16} /> Culture & vie associative pour tous les publics
            </span>
            <h1 id="hero-title" className={styles.title}>
              Des événements où <span className={styles.highlight}>chacun a sa place</span>.
            </h1>
            <p className={styles.lead}>
              Ateliers, spectacles, conférences et expositions avec langue des signes, boucle magnétique, audiodescription, accès fauteuil ou transport adapté. Trouvez, filtrez et réservez en quelques clics.
            </p>
            <form role="search" onSubmit={submit} className={styles.search} aria-label="Rechercher un événement">
              <label htmlFor="hero-q" className="sr-only">
                Rechercher un événement, un lieu ou une ville
              </label>
              <Icon name="search" className={styles.searchIcon} />
              <input id="hero-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Concert, atelier, Tunis…" className={styles.searchInput} />
              <button type="submit" className="btn btn--gold">
                Rechercher
              </button>
            </form>
            <ul className={styles.quick} aria-label="Recherches rapides par service d'accessibilité">
              {ACCESSIBILITY_FEATURES.filter((f) => QUICK.includes(f.key)).map((f) => (
                <li key={f.key}>
                  <Link to={`/evenements?features=${f.key}`} className={styles.chip}>
                    <Icon name={f.icon} size={18} /> {f.short}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${styles.heroArt} decorative decorative-large`} aria-hidden="true">
            <div className={styles.artCard}>
              <Icon name="hands" size={30} />
              <strong>Langue des signes</strong>
              <span>Interprètes LST confirmés</span>
            </div>
            <div className={`${styles.artCard} ${styles.artCard2}`}>
              <Icon name="audio" size={30} />
              <strong>Audiodescription</strong>
              <span>Casques fournis sur place</span>
            </div>
            <div className={`${styles.artCard} ${styles.artCard3}`}>
              <Icon name="wheelchair" size={30} />
              <strong>Accès fauteuil</strong>
              <span>Places PMR réservées</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="upcoming-title">
        <div className="container">
          <div className="row-between" style={{ marginBottom: 'var(--sp-5)' }}>
            <div>
              <span className="eyebrow">À l'affiche</span>
              <h2 id="upcoming-title">Prochains événements</h2>
            </div>
            <Link to="/evenements" className="btn btn--secondary">
              Voir tous les événements <Icon name="arrow" size={18} />
            </Link>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading ? (
            <div className="card-grid" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <EventCardSkeleton key={i} />
              ))}
              <span className="sr-only" role="status">Chargement des événements…</span>
            </div>
          ) : data.items.length ? (
            <ul className="card-grid">
              {data.items.map((e, i) => (
                <li key={e.id}>
                  <EventCard event={e} eager={i < 3} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucun événement à venir pour le moment">Revenez bientôt : les associations publient régulièrement de nouveaux rendez-vous.</EmptyState>
          )}
        </div>
      </section>

      {cats?.categories?.length > 0 && (
        <section className="section-tight" aria-labelledby="cats-title">
          <div className="container">
            <h2 id="cats-title">Explorer par catégorie</h2>
            <ul className={styles.cats}>
              {cats.categories.map((c) => (
                <li key={c._id}>
                  <Link to={`/evenements?category=${c.slug}`} className={styles.cat}>
                    <strong>{c.name}</strong>
                    <span>{c.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <span className="eyebrow">Comment ça marche</span>
          <h2 id="how-title">Réserver en toute sérénité</h2>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepNum} aria-hidden="true">1</span>
              <h3>Filtrez selon vos besoins</h3>
              <p>Langue des signes, boucle magnétique, audiodescription, accès fauteuil, transport adapté, espace calme…</p>
            </li>
            <li>
              <span className={styles.stepNum} aria-hidden="true">2</span>
              <h3>Réservez vos places</h3>
              <p>Indiquez vos besoins à l'organisateur. Les places sont garanties : aucune surréservation possible.</p>
            </li>
            <li>
              <span className={styles.stepNum} aria-hidden="true">3</span>
              <h3>Recevez votre confirmation</h3>
              <p>Notification, e-mail, rappel la veille et ajout à votre agenda en un clic (fichier iCal).</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section-tight" aria-labelledby="orga-title">
        <div className="container">
          <div className={`${styles.cta} on-dark`}>
            <div>
              <h2 id="orga-title" style={{ color: '#fff' }}>
                Vous organisez des événements ?
              </h2>
              <p>Publiez gratuitement, gérez vos jauges et suivez la fréquentation depuis votre tableau de bord.</p>
            </div>
            <Link to="/inscription?role=organizer" className="btn btn--gold">
              Devenir organisateur
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
