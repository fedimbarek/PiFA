import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Fetch data on mount / when `deps` change. Returns { data, error, loading, reload }.
 * Aborts in-flight requests on change/unmount.
 */
export function useApi(path, query, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const ctrl = useRef(null);
  const key = JSON.stringify([path, query]);

  const load = useCallback(async () => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(path, query, { signal: c.signal });
      if (!c.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ data: null, error, loading: false });
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

/** Set the document title (WCAG 2.4.2). */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — InclusiVenue` : 'InclusiVenue — Événements culturels accessibles';
  }, [title]);
}
