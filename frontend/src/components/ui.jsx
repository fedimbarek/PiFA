import { forwardRef, useId } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { ACCESSIBILITY_FEATURES, EVENT_STATUS_LABEL, EVENT_STATUS_TONE } from '../lib/format.js';

/* ---------- Form fields: label + hint + error wired with aria-describedby ---------- */
function describedBy(hintId, errId, hint, error) {
  return [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
}

export const TextField = forwardRef(function TextField({ label, hint, error, required, as = 'input', id: idProp, children, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const Comp = as;
  const cls = as === 'textarea' ? 'textarea' : as === 'select' ? 'select' : 'input';
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && (
          <>
            {' '}
            <span className="req" aria-hidden="true">*</span>
            <span className="sr-only"> (obligatoire)</span>
          </>
        )}
      </label>
      {hint && (
        <span id={hintId} className="hint">
          {hint}
        </span>
      )}
      <Comp
        ref={ref}
        id={id}
        className={cls}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(hintId, errId, hint, error)}
        {...rest}
      >
        {children}
      </Comp>
      {error && (
        <span id={errId} className="field-error">
          <Icon name="alert" size={18} /> {error}
        </span>
      )}
    </div>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, hint, error, id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div>
      <label className="check" htmlFor={id}>
        <input ref={ref} id={id} type="checkbox" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
        <span>
          {label}
          {hint && (
            <span id={`${id}-hint`} className="hint" style={{ display: 'block' }}>
              {hint}
            </span>
          )}
        </span>
      </label>
      {error && (
        <span id={`${id}-err`} className="field-error">
          <Icon name="alert" size={18} /> {error}
        </span>
      )}
    </div>
  );
});

/** Lists every error at the top of a form after a failed submit; links focus the field. */
export function ErrorSummary({ errors, labels, id = 'error-summary' }) {
  const entries = Object.entries(errors || {}).filter(([, v]) => v?.message || typeof v === 'string');
  if (!entries.length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} id={id}>
      <h2>Le formulaire contient {entries.length > 1 ? `${entries.length} erreurs` : 'une erreur'}</h2>
      <ul>
        {entries.map(([k, v]) => (
          <li key={k}>
            <a
              href={`#f-${k}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`f-${k}`)?.focus();
              }}
            >
              {labels?.[k] ? `${labels[k]} : ` : ''}
              {v.message || v}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Merge API field errors into React Hook Form. */
export function applyServerErrors(err, setError, map = {}) {
  for (const [k, msg] of Object.entries(err?.fields || {})) {
    setError(map[k] || k.split('.').pop(), { type: 'server', message: msg });
  }
}

/* ---------- States ---------- */
export function Loading({ label = 'Chargement en cours…' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner decorative" aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function EmptyState({ icon = 'search', title, children, action }) {
  return (
    <div className="state">
      <Icon name={icon} size={40} className="decorative" />
      <h2 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <Icon name="alert" size={40} className="decorative" />
      <h2 style={{ fontSize: 'var(--fs-xl)' }}>Un problème est survenu</h2>
      <p className="muted">{error?.message || 'Impossible de charger les données.'}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

/* ---------- Badges ---------- */
export function StatusBadge({ status }) {
  return <span className={`badge badge--${EVENT_STATUS_TONE[status] || 'muted'}`}>{EVENT_STATUS_LABEL[status] || status}</span>;
}

export function AccessibilityBadges({ accessibility = {}, max, size = 16 }) {
  const list = ACCESSIBILITY_FEATURES.filter((f) => accessibility[f.key]);
  if (!list.length) return <p className="small muted">Aucun service d&rsquo;accessibilité renseigné.</p>;
  const shown = max ? list.slice(0, max) : list;
  return (
    <ul className="badge-list" aria-label="Services d'accessibilité">
      {shown.map((f) => (
        <li key={f.key} className="badge">
          <Icon name={f.icon} size={size} />
          {max ? f.short : f.label}
        </li>
      ))}
      {max && list.length > max && <li className="badge badge--muted">+{list.length - max}<span className="sr-only"> autres services</span></li>}
    </ul>
  );
}

/* ---------- Page chrome ---------- */
export function PageHeader({ title, eyebrow, intro, crumbs, actions }) {
  return (
    <div className="page-head on-dark">
      <div className="container">
        {crumbs && (
          <nav aria-label="Fil d'Ariane" className="breadcrumb">
            <ol>
              {crumbs.map((c, i) => (
                <li key={c.label}>{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
              ))}
            </ol>
          </nav>
        )}
        <div className="row-between">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h1 tabIndex={-1} id="page-title">
              {title}
            </h1>
            {intro && <p>{intro}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

/** Side navigation for the participant / organizer / admin spaces. */
export function SpaceLayout({ title, links, children }) {
  return (
    <div className="container space">
      <nav className="space-nav" aria-label={title}>
        <h2>{title}</h2>
        <ul>
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end}>
                <Icon name={l.icon} />
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}

export function Pagination({ page, pages, onChange, label = 'Pagination des résultats' }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="pagination" aria-label={label}>
      <ul>
        <li>
          <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
            <span aria-hidden="true">‹</span>
            <span className="sr-only">Page précédente</span>
          </button>
        </li>
        {nums.map((n) => (
          <li key={n}>
            <button type="button" onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>
              <span className="sr-only">Page </span>
              {n}
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>
            <span aria-hidden="true">›</span>
            <span className="sr-only">Page suivante</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
