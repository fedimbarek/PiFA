import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { Modal } from './Modal.jsx';
import { homeForRole, useAuth } from '../context/AuthContext.jsx';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ROLE_LABEL } from '../lib/format.js';
import { Loading } from './ui.jsx';

function Brand() {
  return (
    <Link to="/" className="brand">
      <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#13305a" />
        <circle cx="32" cy="17" r="6" fill="#E3B341" />
        <path d="M18 28h28M32 28v22M22 50l10-12 10 12" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span>
        Inclusi<span className="brand__accent">Venue</span>
      </span>
      <span className="sr-only"> — accueil</span>
    </Link>
  );
}

/** Quick display settings available to everyone (visitors included). */
export function DisplaySettings({ open, onClose }) {
  const { prefs, update, reset } = usePreferences();
  const { user } = useAuth();
  const sizes = [100, 112, 125, 150, 175, 200];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Préférences d'affichage"
      description={user ? 'Vos choix sont enregistrés sur votre compte.' : 'Vos choix sont enregistrés dans ce navigateur. Connectez-vous pour les retrouver partout.'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={reset}>
            Rétablir les valeurs par défaut
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Terminé
          </button>
        </>
      }
    >
      <fieldset>
        <legend>Taille du texte</legend>
        <div className="row">
          {sizes.map((s) => (
            <label key={s} className="check" style={{ minWidth: 92 }}>
              <input type="radio" name="fontScale" value={s} checked={prefs.fontScale === s} onChange={() => update({ fontScale: s })} />
              {s} %
            </label>
          ))}
        </div>
      </fieldset>
      <div className="stack" style={{ marginTop: 'var(--sp-4)' }}>
        {[
          ['highContrast', 'Contraste élevé', 'Noir et blanc renforcé, liens soulignés.'],
          ['reducedMotion', 'Réduire les animations', 'Supprime les transitions et effets de mouvement.'],
          ['dyslexiaFont', 'Lecture facilitée', 'Espacement des lettres, des mots et des lignes augmenté.'],
          ['underlineLinks', 'Souligner tous les liens', null],
        ].map(([k, label, hint]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={Boolean(prefs[k])} onChange={(e) => update({ [k]: e.target.checked })} />
            <span>
              {label}
              {hint && <span className="hint" style={{ display: 'block' }}>{hint}</span>}
            </span>
          </label>
        ))}
      </div>
      <p className="small" style={{ marginTop: 'var(--sp-4)' }}>
        Plus d&rsquo;options (mode lecteur d&rsquo;écran, mode sourd/malentendant, besoins par défaut) :{' '}
        {user ? <Link to="/mon-espace/accessibilite" onClick={onClose}>mes réglages d&rsquo;accessibilité</Link> : <Link to="/connexion" onClick={onClose}>connectez-vous</Link>}.
      </p>
    </Modal>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btn = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const doLogout = async () => {
    close();
    await logout();
    toast.success('Vous êtes déconnecté(e).');
    navigate('/');
  };

  return (
    <div className="menu" ref={ref}>
      <button ref={btn} type="button" className="nav-btn" aria-expanded={open} aria-controls="user-menu" onClick={() => setOpen((o) => !o)}>
        <Icon name="user" />
        <span className="hide-mobile">{user.name.split(' ')[0]}</span>
        <span className="sr-only">— menu du compte ({ROLE_LABEL[user.role]})</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <ul id="user-menu" className="menu__list">
          <li className="menu__label" aria-hidden="true">{ROLE_LABEL[user.role]}</li>
          {user.role === 'admin' && (
            <>
              <li><Link to="/admin" onClick={close}><Icon name="shield" /> Administration</Link></li>
              <li><Link to="/admin/moderation" onClick={close}><Icon name="check" /> Modération</Link></li>
            </>
          )}
          {(user.role === 'organizer' || user.role === 'admin') && (
            <>
              <li><Link to="/organisateur" onClick={close}><Icon name="grid" /> Espace organisateur</Link></li>
              <li><Link to="/organisateur/evenements/nouveau" onClick={close}><Icon name="plus" /> Créer un événement</Link></li>
            </>
          )}
          <li><Link to="/mon-espace" onClick={close}><Icon name="home" /> Mon espace</Link></li>
          <li><Link to="/mon-espace/reservations" onClick={close}><Icon name="ticket" /> Mes réservations</Link></li>
          <li><Link to="/mon-espace/profil" onClick={close}><Icon name="user" /> Mon profil</Link></li>
          <li><Link to="/mon-espace/accessibilite" onClick={close}><Icon name="eye" /> Accessibilité</Link></li>
          <li className="menu__sep" aria-hidden="true" />
          <li><button type="button" onClick={doLogout}><Icon name="logout" /> Se déconnecter</button></li>
        </ul>
      )}
    </div>
  );
}

function Header() {
  const { user, unread } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <header className="site-header on-dark">
      <div className="container site-header__inner" style={{ position: 'relative' }}>
        <Brand />
        <nav className="main-nav" aria-label="Navigation principale" id="main-nav" data-open={navOpen}>
          <ul>
            <li><NavLink to="/evenements">Événements</NavLink></li>
            <li><NavLink to="/carte">Carte</NavLink></li>
            <li><NavLink to="/a-propos">À propos</NavLink></li>
            <li><NavLink to="/contact">Contact</NavLink></li>
            {!user && (
              <>
                <li className="show-mobile-only"><NavLink to="/connexion">Connexion</NavLink></li>
                <li className="show-mobile-only"><NavLink to="/inscription">Inscription</NavLink></li>
              </>
            )}
          </ul>
        </nav>
        <div className="header-actions">
          <button type="button" className="nav-btn" onClick={() => setDisplayOpen(true)}>
            <Icon name="eye" />
            <span className="hide-mobile">Affichage</span>
            <span className="sr-only"> : préférences d&rsquo;affichage</span>
          </button>
          {user ? (
            <>
              <Link to="/mon-espace/notifications" className="nav-btn">
                <Icon name="bell" />
                <span className="sr-only">Notifications{unread ? ` : ${unread} non lue${unread > 1 ? 's' : ''}` : ''}</span>
                {unread > 0 && <span className="count-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/connexion" className="nav-btn hide-mobile">Connexion</Link>
              <Link to="/inscription" className="btn btn--gold btn--sm hide-mobile">Créer un compte</Link>
            </>
          )}
          <button type="button" className="nav-btn burger" aria-expanded={navOpen} aria-controls="main-nav" onClick={() => setNavOpen((o) => !o)}>
            <Icon name={navOpen ? 'close' : 'menu'} />
            <span className="sr-only">{navOpen ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
          </button>
        </div>
      </div>
      <DisplaySettings open={displayOpen} onClose={() => setDisplayOpen(false)} />
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer on-dark">
      <div className="container">
        <div className="footer-grid">
          <div>
            <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: '#fff', marginBottom: 'var(--sp-2)' }}>
              Inclusi<span style={{ color: 'var(--gold-400)' }}>Venue</span>
            </p>
            <p>La culture accessible à toutes et à tous : réservez des événements adaptés à vos besoins.</p>
          </div>
          <nav aria-label="Découvrir">
            <h2>Découvrir</h2>
            <ul>
              <li><Link to="/evenements">Tous les événements</Link></li>
              <li><Link to="/carte">Carte des lieux</Link></li>
              <li><Link to="/evenements?features=signLanguage">Avec langue des signes</Link></li>
              <li><Link to="/evenements?features=wheelchair">Accessibles en fauteuil</Link></li>
            </ul>
          </nav>
          <nav aria-label="Organisateurs">
            <h2>Organisateurs</h2>
            <ul>
              <li><Link to="/inscription?role=organizer">Publier un événement</Link></li>
              <li><Link to="/a-propos">Notre démarche</Link></li>
            </ul>
          </nav>
          <nav aria-label="Informations">
            <h2>Informations</h2>
            <ul>
              <li><Link to="/accessibilite">Déclaration d&rsquo;accessibilité</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/plan-du-site">Plan du site</Link></li>
            </ul>
          </nav>
        </div>
        <div className="footer-bottom row-between">
          <span>© {new Date().getFullYear()} InclusiVenue — Projet intégré FullstackJS</span>
          <span>Accessibilité : partiellement conforme RGAA / WCAG 2.1 AA</span>
        </div>
      </div>
    </footer>
  );
}

/** Move focus to the page heading after client-side navigation (SR announce + keyboard start point). */
function useRouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const t = setTimeout(() => {
      const target = document.querySelector('#main h1') || document.getElementById('main');
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [pathname]);
}

export function Layout() {
  useRouteFocus();
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Aller au contenu principal
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="container section"><Loading /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container section"><Loading label="Vérification de votre session…" /></div>;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace state={{ denied: true }} />;
  return children;
}
