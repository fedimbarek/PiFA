import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const r = await api.get('/notifications/unread-count');
      setUnread(r.unread);
    } catch {
      /* not logged in or offline: keep previous count */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get('/auth/me')
      .then((r) => alive && setUser(r.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    refreshUnread();
    const t = setInterval(refreshUnread, 60_000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setUser(r.user);
    return r.user;
  }, []);

  const register = useCallback(async (data) => {
    const r = await api.post('/auth/register', data);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setUnread(0);
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout, unread, setUnread, refreshUnread }), [user, loading, login, register, logout, unread, refreshUnread]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeForRole = (role) => (role === 'admin' ? '/admin' : role === 'organizer' ? '/organisateur' : '/mon-espace');
