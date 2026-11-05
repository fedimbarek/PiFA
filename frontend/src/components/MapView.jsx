import { useEffect, useRef, useState } from 'react';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { formatShort } from '../lib/format.js';

const TILES = import.meta.env?.VITE_MAP_TILES || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Interactive map (Leaflet + OpenStreetMap), loaded lazily. Accessibility:
 *  - the map is a labelled region and is never the only way to get information:
 *    the parent page always renders the equivalent text list of venues;
 *  - markers are keyboard-focusable (Tab) and open their popup with Enter;
 *  - each marker has a text alternative (title + date);
 *  - if the library or the tiles cannot load, a message is shown and the list remains.
 */
export function MapView({ events, selectedId, onSelect, height = 460, label = 'Carte des lieux des événements' }) {
  const el = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [status, setStatus] = useState('loading');
  const { prefs } = usePreferences();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        if (cancelled || !el.current) return;
        map.current = L.map(el.current, { scrollWheelZoom: false, keyboard: true, zoomAnimation: !prefs.reducedMotion, fadeAnimation: !prefs.reducedMotion });
        L.tileLayer(TILES, { maxZoom: 18, attribution: '&copy; contributeurs OpenStreetMap' }).addTo(map.current);
        map.current.setView([35.8, 10.2], 6);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'ready' || !map.current) return;
    (async () => {
      const { default: L } = await import('leaflet');
      Object.values(markers.current).forEach((m) => m.remove());
      markers.current = {};
      const pts = events.filter((e) => typeof e.venue?.latitude === 'number');
      for (const e of pts) {
        const icon = L.divIcon({
          className: 'iv-marker',
          html: '<span aria-hidden="true"></span>',
          iconSize: [30, 30],
          iconAnchor: [15, 28],
        });
        const m = L.marker([e.venue.latitude, e.venue.longitude], { icon, keyboard: true, title: `${e.title} — ${formatShort(e.startDate)}`, alt: e.title })
          .addTo(map.current)
          .bindPopup(
            `<strong>${escapeHtml(e.title)}</strong><br>${escapeHtml(e.venue.name)}, ${escapeHtml(e.venue.city)}<br>${escapeHtml(formatShort(e.startDate))}<br><a href="/evenements/${e.id}">Voir l'événement</a>`,
          );
        m.on('click', () => onSelect?.(e.id));
        m.on('keypress', (ev) => {
          if (ev.originalEvent.key === 'Enter') m.openPopup();
        });
        markers.current[e.id] = m;
      }
      if (pts.length) map.current.fitBounds(L.latLngBounds(pts.map((e) => [e.venue.latitude, e.venue.longitude])), { padding: [40, 40], maxZoom: 12 });
    })();
  }, [events, status, onSelect]);

  useEffect(() => {
    const m = markers.current[selectedId];
    if (m && map.current) {
      map.current.setView(m.getLatLng(), 13, { animate: !prefs.reducedMotion });
      m.openPopup();
    }
  }, [selectedId, prefs.reducedMotion]);

  return (
    <div>
      <div
        ref={el}
        role="region"
        aria-label={`${label}. Utilisez Tab pour parcourir les marqueurs et Entrée pour afficher les détails. La liste des lieux est disponible sous la carte.`}
        style={{ height, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--card-border)', background: 'var(--surface-3)' }}
        className="iv-map"
      />
      {status === 'loading' && <p className="small muted" role="status">Chargement de la carte…</p>}
      {status === 'error' && (
        <p className="alert alert--warning" role="status" style={{ marginTop: 'var(--sp-3)' }}>
          La carte interactive n&rsquo;a pas pu être chargée. Tous les lieux restent disponibles dans la liste ci-dessous.
        </p>
      )}
    </div>
  );
}
