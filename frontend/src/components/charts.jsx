import { Icon } from './Icon.jsx';
import { percent } from '../lib/format.js';
import styles from './charts.module.css';

export function StatCard({ label, value, icon = 'chart', hint, tone }) {
  return (
    <li className={`${styles.stat} ${tone ? styles[tone] : ''}`}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </li>
  );
}

/**
 * Horizontal bar chart. The visual bars are aria-hidden; the same data is
 * exposed as a real <table> (visually styled as the chart legend) so screen
 * reader users get the exact numbers.
 */
export function BarChart({ title, data, valueKey = 'value', labelKey = 'label', format = (v) => v, max }) {
  const top = max ?? Math.max(1, ...data.map((d) => d[valueKey] || 0));
  if (!data.length) return <p className="muted">Aucune donnée pour le moment.</p>;
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{title}</figcaption>
      <table className={styles.table}>
        <thead className="sr-only">
          <tr>
            <th scope="col">Élément</th>
            <th scope="col">Valeur</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d[labelKey]}>
              <th scope="row" className={styles.rowLabel}>
                {d[labelKey]}
              </th>
              <td className={styles.cell}>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.bar} style={{ width: `${Math.max(2, ((d[valueKey] || 0) / top) * 100)}%` }} />
                </span>
                <span className={styles.num}>{format(d[valueKey] || 0)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Occupancy({ value, label }) {
  return (
    <div>
      <div className="row-between small">
        <span>{label}</span>
        <strong>{percent(value)}</strong>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
