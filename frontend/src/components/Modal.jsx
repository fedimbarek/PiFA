import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.jsx';
import styles from './Modal.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: role="dialog" + aria-modal, labelled by its title,
 * focus moved inside on open and trapped (Tab / Shift+Tab), Escape closes,
 * focus returned to the trigger on close, background made inert.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', initialFocus }) {
  const titleId = useId();
  const descId = useId();
  const ref = useRef(null);
  const lastActive = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastActive.current = document.activeElement;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const target = (initialFocus && ref.current?.querySelector(initialFocus)) || ref.current?.querySelector(FOCUSABLE) || ref.current;
      target?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      root?.removeAttribute('inert');
      root?.removeAttribute('aria-hidden');
      document.body.style.overflow = '';
      lastActive.current?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="presentation">
      <div
        ref={ref}
        className={`${styles.dialog} ${styles[size] || ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer la fenêtre">
            <Icon name="close" />
          </button>
        </div>
        {description && (
          <p id={descId} className="muted">
            {description}
          </p>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', tone = 'primary', busy, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      size="sm"
      initialFocus="[data-cancel]"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onCancel} data-cancel>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn--danger' : ''}`} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'Veuillez patienter…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
