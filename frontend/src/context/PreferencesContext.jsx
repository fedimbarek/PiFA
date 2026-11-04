import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

export const DEFAULT_PREFS = {
  fontScale: 100,
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  dyslexiaFont: false,
  underlineLinks: false,
  hearingMode: false,
  preferredFeatures: [],
  emailNotifications: true,
  otherNeeds: '',
};
const KEY = 'iv-display-prefs';

function readLocal() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Reflect preferences on <html> so CSS can adapt the whole interface. */
export function applyPrefs(p) {
  const el = document.documentElement;
  el.style.fontSize = `${p.fontScale}%`;
  el.dataset.contrast = p.highContrast ? 'high' : 'normal';
  el.dataset.motion = p.reducedMotion ? 'reduce' : 'auto';
  el.dataset.font = p.dyslexiaFont ? 'readable' : 'default';
  el.dataset.underline = String(Boolean(p.underlineLinks));
  el.dataset.sr = String(Boolean(p.screenReaderMode));
  el.dataset.hearing = String(Boolean(p.hearingMode));
  // Large text: switch header to the compact (burger) navigation to avoid horizontal scrolling.
  el.dataset.large = String(p.fontScale >= 125);
}

const PrefsContext = createContext(null);

/**
 * Visitors: preferences stored in this browser (localStorage).
 * Logged-in users: stored on their account (API) → persist across devices and sessions.
 */
export function PreferencesProvider({ children }) {
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState(readLocal);

  useEffect(() => {
    if (user?.preferences) setPrefs({ ...DEFAULT_PREFS, ...user.preferences });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyPrefs(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable (private mode) — preferences still apply for this visit */
    }
  }, [prefs]);

  const update = useCallback(
    async (patch) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      if (user) {
        const r = await api.put('/users/me/preferences', patch);
        setUser((u) => (u ? { ...u, preferences: r.preferences } : u));
        return r.preferences;
      }
      return next;
    },
    [prefs, user, setUser],
  );

  const reset = useCallback(() => update(DEFAULT_PREFS), [update]);
  const value = useMemo(() => ({ prefs, update, reset }), [prefs, update, reset]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePreferences = () => useContext(PrefsContext);
