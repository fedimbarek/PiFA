import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { AccessibilityBadges } from './ui.jsx';
import { assetUrl } from '../lib/api.js';
import { dayParts, formatPrice, formatShort, seatsLabel } from '../lib/format.js';
import styles from './EventCard.module.css';

/**
 * Event card. The whole card is clickable through the title link's ::after
 * overlay, so there is a single tab stop and a meaningful link name.
 */
export function EventCard({ event, headingLevel = 3, eager = false }) {
  const H = `h${headingLevel}`;
  const { day, month } = dayParts(event.startDate);
  const full = event.availableSeats === 0;
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {event.coverImage?.url ? (
          <img
            src={assetUrl(event.coverImage.url)}
            alt={event.coverImage.alt || ''}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            width="640"
            height="360"
            {...(eager ? { fetchpriority: 'high' } : {})}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <Icon name="sparkle" size={40} />
          </div>
        )}
        <div className={styles.date} aria-hidden="true">
          <span className={styles.day}>{day}</span>
          <span className={styles.month}>{month}</span>
        </div>
        {event.category?.name && <span className={styles.category}>{event.category.name}</span>}
      </div>
      <div className={styles.body}>
        <H className={styles.title}>
          <Link to={`/evenements/${event.id || event._id}`} className={styles.link}>
            {event.title}
          </Link>
        </H>
        <ul className={styles.meta}>
          <li>
            <Icon name="calendar" size={18} />
            <span>
              <span className="sr-only">Date : </span>
              {formatShort(event.startDate)}
            </span>
          </li>
          <li>
            <Icon name="pin" size={18} />
            <span>
              <span className="sr-only">Lieu : </span>
              {event.venue?.name}, {event.venue?.city}
            </span>
          </li>
        </ul>
        <AccessibilityBadges accessibility={event.accessibility} max={3} size={14} />
        <div className={styles.footer}>
          <span className={styles.price}>{formatPrice(event.price)}</span>
          <span className={full ? styles.full : styles.seats}>{seatsLabel(event)}</span>
        </div>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return <div className={`skeleton ${styles.skeleton}`} aria-hidden="true" />;
}
