import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon.jsx';

const ToastContext = createContext(null);

/**
 * Accessible toasts: rendered inside persistent live regions (polite for info /
 * success, assertive for errors) so screen readers announce them; they stay at
 * least 8 s, pause on hover/focus and can be dismissed with a button.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const schedule = useCallback((id, ms) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const notify = useCallback(
    (message, { type = 'info', title } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((t) => [...t.slice(-3), { id, message, type, title }]);
      schedule(id, type === 'error' ? 12000 : 8000);
      return id;
    },
    [schedule],
  );

  const value = useMemo(
    () => ({
      notify,
      success: (m, o) => notify(m, { ...o, type: 'success' }),
      error: (m, o) => notify(m, { ...o, type: 'error' }),
      dismiss,
    }),
    [notify, dismiss],
  );

  const render = (list) =>
    list.map((t) => (
      <div
        key={t.id}
        role="presentation"
        className={`toast toast--${t.type}`}
        onMouseEnter={() => clearTimeout(timers.current[t.id])}
        onMouseLeave={() => schedule(t.id, 4000)}
        onFocus={() => clearTimeout(timers.current[t.id])}
      >
        <Icon name={t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'info'} size={22} />
        <div style={{ flex: 1 }}>
          {t.title && <p><strong>{t.title}</strong></p>}
          <p>{t.message}</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Fermer le message">
          <Icon name="close" size={18} />
        </button>
      </div>
    ));

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region">
        <div role="status" aria-live="polite" aria-atomic="false" className="toast-stack">
          {render(toasts.filter((t) => t.type !== 'error'))}
        </div>
        <div role="alert" aria-live="assertive" className="toast-stack">
          {render(toasts.filter((t) => t.type === 'error'))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
