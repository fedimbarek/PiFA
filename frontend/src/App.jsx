import { useEffect, useRef, useState } from 'react';

const A11Y = { signLanguage: 'Langue des signes', hearingLoop: 'Boucle magnétique', wheelchair: 'Accès fauteuil', audioDescription: 'Audiodescription', adaptedTransport: 'Transport adapté' };
const fmt = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
const toggle = (arr, k, on) => (on ? [...arr, k] : arr.filter((x) => x !== k));

async function api(path, { body, method, raw } = {}, token) {
  const r = await fetch('/api' + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  if (raw && r.ok) return r;
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Une erreur est survenue.');
  return d;
}

export default function App() {
  const [view, setView] = useState('events');
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('iv-session') || 'null'));
  const [msg, setMsg] = useState(null);
  const main = useRef();
  const token = session?.token, user = session?.user;

  useEffect(() => { // applique les préférences d'accessibilité au chargement et à la connexion
    const p = user?.prefs || JSON.parse(localStorage.getItem('iv-prefs') || '{"fontSize":100}');
    document.documentElement.style.fontSize = (p.fontSize || 100) + '%';
    document.documentElement.dataset.contrast = p.contrast ? 'high' : 'normal';
  }, [user]);
  useEffect(() => { main.current?.focus(); }, [view]); // focus géré à chaque changement de page

  const say = (text, type = 'ok') => setMsg({ text, type });
  const login = (s) => { localStorage.setItem('iv-session', JSON.stringify(s)); setSession(s); say(`Bonjour ${s.user.name}, vous êtes connecté.`); setView('events'); };
  const logout = () => { localStorage.removeItem('iv-session'); setSession(null); say('Vous êtes déconnecté.'); setView('events'); };
  const nav = [['events', 'Événements'], ...(user ? [['bookings', 'Mes réservations']] : []), ...(user && user.role !== 'user' ? [['organizer', 'Espace organisateur']] : []), ...(user?.role === 'admin' ? [['admin', 'Administration']] : []), ['prefs', 'Accessibilité'], ...(user ? [] : [['login', 'Connexion']])];

  return (<>
    <a className="skip" href="#main">Aller au contenu principal</a>
    <header className="top"><div className="wrap">
      <span className="logo">InclusiVenue</span>
      <nav aria-label="Navigation principale"><ul>
        {nav.map(([k, l]) => <li key={k}><button onClick={() => setView(k)} aria-current={view === k ? 'page' : undefined}>{l}</button></li>)}
        {user && <li><button onClick={logout}>Se déconnecter</button></li>}
      </ul></nav>
    </div></header>
    <main id="main" tabIndex={-1} ref={main}><div className="wrap">
      <div role="status" aria-live="polite">{msg && <p className={'msg ' + msg.type}>{msg.text}</p>}</div>
      {view === 'events' && <Events token={token} say={say} setView={setView} />}
      {view === 'login' && <Auth onDone={login} />}
      {view === 'bookings' && <Bookings token={token} say={say} />}
      {view === 'organizer' && <Organizer token={token} say={say} />}
      {view === 'admin' && <Admin token={token} say={say} />}
      {view === 'prefs' && <Prefs session={session} setSession={setSession} say={say} />}
    </div></main>
    <footer><div className="wrap">InclusiVenue — projet intégré FullstackJS, conçu pour viser WCAG 2.1 AA.</div></footer>
  </>);
}

function Events({ token, say, setView }) {
  const [f, setF] = useState({ q: '', acc: [], free: false, page: 1 });
  const [tick, setTick] = useState(0);
  const [data, setData] = useState({ items: [], total: 0 });
  useEffect(() => {
    const p = new URLSearchParams({ ...(f.q && { q: f.q }), ...(f.acc.length && { accessibility: f.acc.join(',') }), ...(f.free && { free: 'true' }), page: f.page });
    const t = setTimeout(() => api('/events?' + p).then(setData).catch((e) => say(e.message, 'err')), 250);
    return () => clearTimeout(t);
  }, [f, tick]);
  const book = async (e) => {
    if (!token) { say('Connectez-vous pour réserver une place.', 'err'); return setView('login'); }
    try { await api(`/events/${e._id}/book`, { body: { seats: 1 } }, token); say(`Place réservée : ${e.title}.`); setTick(tick + 1); } catch (x) { say(x.message, 'err'); }
  };
  return (<>
    <section className="hero"><h1>La culture, sans barrières.</h1>
      <p>Ateliers, spectacles et expositions avec langue des signes, boucle magnétique, audiodescription et accès adapté.</p></section>
    <form className="filters" role="search" aria-label="Rechercher un événement" onSubmit={(e) => e.preventDefault()}>
      <div><label htmlFor="q">Rechercher un événement</label><input id="q" type="text" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} /></div>
      <fieldset><legend>Accessibilité souhaitée</legend>
        {Object.entries(A11Y).map(([k, l]) => <label className="chip" key={k}><input type="checkbox" checked={f.acc.includes(k)} onChange={(e) => setF({ ...f, acc: toggle(f.acc, k, e.target.checked), page: 1 })} /><span>{l}</span></label>)}
        <label className="chip"><input type="checkbox" checked={f.free} onChange={(e) => setF({ ...f, free: e.target.checked, page: 1 })} /><span>Gratuit</span></label>
      </fieldset>
    </form>
    <h2 aria-live="polite">{data.total} événement{data.total > 1 ? 's' : ''} trouvé{data.total > 1 ? 's' : ''}</h2>
    {data.items.length === 0 ? <p>Aucun résultat. Essayez de retirer un filtre.</p> :
      <ul className="grid">{data.items.map((e) => <li key={e._id}><article className="card feat">
        <h3>{e.title}</h3><p className="meta"><time dateTime={e.date}>{fmt(e.date)}</time></p><p className="meta">{e.place}</p>
        <p>{e.description}</p>
        <ul className="badges" aria-label="Aménagements d'accessibilité">{e.accessibility.map((a) => <li key={a}>{A11Y[a]}</li>)}</ul>
        <p className="meta">{e.free ? 'Gratuit' : e.price + ' TND'} — {e.capacity - e.booked} place(s) restante(s)</p>
        <button className="btn" disabled={e.booked >= e.capacity} onClick={() => book(e)} aria-label={`Réserver une place pour ${e.title}`}>{e.booked >= e.capacity ? 'Complet' : 'Réserver une place'}</button>
      </article></li>)}</ul>}
    {data.pages > 1 && <nav className="row" aria-label="Pagination" style={{ marginTop: '1.5rem' }}>
      <button className="btn alt" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Page précédente</button>
      <span>Page {f.page} sur {data.pages}</span>
      <button className="btn alt" disabled={f.page >= data.pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Page suivante</button></nav>}
  </>);
}

function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'user' });
  const [err, setErr] = useState('');
  const submit = async (e) => { e.preventDefault(); try { onDone(await api('/auth/' + mode, { body: v })); } catch (x) { setErr(x.message); } };
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (<section><h2>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
    <form className="form" onSubmit={submit} noValidate>
      {err && <p className="msg err" role="alert">{err}</p>}
      {mode === 'register' && <div><label htmlFor="n">Nom</label><input id="n" type="text" autoComplete="name" value={v.name} onChange={set('name')} required /></div>}
      <div><label htmlFor="e">Email</label><input id="e" type="email" autoComplete="email" value={v.email} onChange={set('email')} required /></div>
      <div><label htmlFor="p">Mot de passe (8 caractères minimum)</label><input id="p" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={v.password} onChange={set('password')} required /></div>
      {mode === 'register' && <div><label htmlFor="r">Je suis</label><select id="r" value={v.role} onChange={set('role')}><option value="user">Participant</option><option value="organizer">Organisateur</option></select></div>}
      <div className="row"><button className="btn">{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button type="button" className="btn alt" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'Créer un compte' : "J'ai déjà un compte"}</button></div>
    </form></section>);
}

function Bookings({ token, say }) {
  const [list, setList] = useState([]);
  const load = () => api('/bookings/mine', {}, token).then(setList).catch((e) => say(e.message, 'err'));
  useEffect(() => { load(); }, []);
  const cancel = async (b) => { await api('/bookings/' + b._id, { method: 'DELETE' }, token); say('Réservation annulée.'); load(); };
  const ics = async () => { const r = await api('/bookings/mine/calendar.ics', { raw: true }, token); const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'inclusivenue.ics'; a.click(); };
  return (<section><h2>Mes réservations</h2>
    <button className="btn alt" onClick={ics}>Exporter vers mon calendrier (.ics)</button>
    {list.length === 0 ? <p>Vous n'avez pas encore réservé. Parcourez les événements pour commencer.</p> :
      <ul className="grid" style={{ marginTop: '1rem' }}>{list.map((b) => <li key={b._id}><article className="card">
        <h3>{b.event.title}</h3><p className="meta">{fmt(b.event.date)}</p><p className="meta">{b.seats} place(s) — {b.status === 'confirmed' ? 'Confirmée' : 'Annulée'}</p>
        {b.status === 'confirmed' && <button className="btn alt" onClick={() => cancel(b)}>Annuler la réservation</button>}
      </article></li>)}</ul>}
  </section>);
}

function Organizer({ token, say }) {
  const [list, setList] = useState([]);
  const empty = { title: '', description: '', place: '', date: '', capacity: 20, free: true, price: 0, accessibility: [] };
  const [v, setV] = useState(empty);
  const load = () => api('/organizer/events', {}, token).then(setList);
  useEffect(() => { load(); }, []);
  const create = async (e) => { e.preventDefault(); try { await api('/events', { body: { ...v, capacity: +v.capacity, price: v.free ? 0 : +v.price } }, token); say('Événement créé en brouillon. Publiez-le pour le rendre visible.'); setV(empty); load(); } catch (x) { say(x.message, 'err'); } };
  const status = async (id, s) => { await api(`/events/${id}/status`, { method: 'PATCH', body: { status: s } }, token); say(s === 'published' ? 'Événement publié.' : 'Événement archivé.'); load(); };
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (<section><h2>Espace organisateur</h2>
    <form className="form" onSubmit={create}>
      <div><label htmlFor="t">Titre</label><input id="t" type="text" value={v.title} onChange={set('title')} required /></div>
      <div><label htmlFor="d">Description</label><textarea id="d" rows="3" value={v.description} onChange={set('description')} /></div>
      <div><label htmlFor="pl">Lieu</label><input id="pl" type="text" value={v.place} onChange={set('place')} /></div>
      <div><label htmlFor="dt">Date et heure</label><input id="dt" type="datetime-local" value={v.date} onChange={set('date')} required /></div>
      <div><label htmlFor="c">Nombre de places</label><input id="c" type="number" min="1" value={v.capacity} onChange={set('capacity')} required /></div>
      <label className="row"><input type="checkbox" checked={v.free} onChange={(e) => setV({ ...v, free: e.target.checked })} /> Événement gratuit</label>
      {!v.free && <div><label htmlFor="pr">Prix (TND)</label><input id="pr" type="number" min="1" value={v.price} onChange={set('price')} /></div>}
      <fieldset><legend>Aménagements proposés</legend>{Object.entries(A11Y).map(([k, l]) => <label className="chip" key={k}><input type="checkbox" checked={v.accessibility.includes(k)} onChange={(e) => setV({ ...v, accessibility: toggle(v.accessibility, k, e.target.checked) })} /><span>{l}</span></label>)}</fieldset>
      <button className="btn">Créer l'événement</button>
    </form>
    <h2 style={{ marginTop: '2.5rem' }}>Mes événements et leur fréquentation</h2>
    <ul className="grid">{list.map((e) => <li key={e._id}><article className="card"><h3>{e.title}</h3>
      <p className="meta">Statut : {{ draft: 'Brouillon', published: 'Publié', archived: 'Archivé' }[e.status]}</p>
      <p><progress max={e.capacity} value={e.booked} aria-label="Taux de remplissage" /> {e.booked}/{e.capacity} places réservées</p>
      <div className="row">{e.status !== 'published' && <button className="btn" onClick={() => status(e._id, 'published')}>Publier</button>}
        {e.status !== 'archived' && <button className="btn alt" onClick={() => status(e._id, 'archived')}>Archiver</button>}</div></article></li>)}</ul>
  </section>);
}

function Prefs({ session, setSession, say }) {
  const p = session?.user?.prefs || JSON.parse(localStorage.getItem('iv-prefs') || '{"fontSize":100,"contrast":false,"deafMode":false}');
  const update = async (n) => {
    const next = { fontSize: 100, contrast: false, deafMode: false, ...p, ...n };
    localStorage.setItem('iv-prefs', JSON.stringify(next));
    document.documentElement.style.fontSize = next.fontSize + '%';
    document.documentElement.dataset.contrast = next.contrast ? 'high' : 'normal';
    if (!session) return say('Préférences appliquées sur cet appareil.');
    try { const u = await api('/me/prefs', { method: 'PUT', body: next }, session.token); const s = { ...session, user: u }; localStorage.setItem('iv-session', JSON.stringify(s)); setSession(s); } catch (e) { say(e.message, 'err'); }
  };
  return (<section><h2>Mes préférences d'accessibilité</h2>
    <div className="form">
      <div><label htmlFor="fs">Taille du texte : {p.fontSize} %</label><input id="fs" type="range" min="100" max="160" step="10" value={p.fontSize} onChange={(e) => update({ fontSize: +e.target.value })} /></div>
      <label className="row"><input type="checkbox" checked={!!p.contrast} onChange={(e) => update({ contrast: e.target.checked })} /> Contraste élevé</label>
      <label className="row"><input type="checkbox" checked={!!p.deafMode} onChange={(e) => update({ deafMode: e.target.checked })} /> Mode sourd et malentendant (alertes visuelles uniquement)</label>
      {!session && <p className="meta">Connectez-vous pour enregistrer ces préférences sur votre compte.</p>}
    </div></section>);
}

function Admin({ token, say }) {
  const [s, setS] = useState(null), [events, setEvents] = useState([]), [users, setUsers] = useState([]);
  const load = () => Promise.all([api('/admin/stats', {}, token), api('/admin/events', {}, token), api('/admin/users', {}, token)])
    .then(([a, b, c]) => { setS(a); setEvents(b); setUsers(c); }).catch((e) => say(e.message, 'err'));
  useEffect(() => { load(); }, []);
  const status = async (id, st) => { await api(`/events/${id}/status`, { method: 'PATCH', body: { status: st } }, token); say(st === 'published' ? 'Événement publié.' : 'Événement archivé.'); load(); };
  const del = async (u) => { try { await api('/admin/users/' + u._id, { method: 'DELETE' }, token); say(`Compte supprimé : ${u.name}.`); load(); } catch (e) { say(e.message, 'err'); } };
  const label = { draft: 'Brouillon', published: 'Publié', archived: 'Archivé' };
  return (<section><h2>Administration</h2>
    {s && <ul className="grid" aria-label="Statistiques globales">{[['Utilisateurs', s.users], ['Événements', s.events], ['Réservations confirmées', s.bookings], ['Brouillons à modérer', s.pending]].map(([l, n]) =>
      <li key={l} className="card"><span className="meta">{l}</span><strong style={{ fontSize: '2.4rem' }}>{n}</strong></li>)}</ul>}
    <h2 style={{ marginTop: '2.5rem' }}>Modération des événements</h2>
    <ul className="grid">{events.map((e) => <li key={e._id}><article className="card"><h3>{e.title}</h3>
      <p className="meta">{e.organizer?.name} — {label[e.status]}</p>
      <div className="row">{e.status !== 'published' && <button className="btn" onClick={() => status(e._id, 'published')}>Publier</button>}
        {e.status !== 'archived' && <button className="btn alt" onClick={() => status(e._id, 'archived')}>Archiver</button>}</div></article></li>)}</ul>
    <h2 style={{ marginTop: '2.5rem' }}>Utilisateurs</h2>
    <ul className="grid">{users.map((u) => <li key={u._id}><article className="card"><h3>{u.name}</h3><p className="meta">{u.email} — {u.role}</p>
      {u.role !== 'admin' && <button className="btn alt" onClick={() => del(u)} aria-label={`Supprimer le compte de ${u.name}`}>Supprimer le compte</button>}</article></li>)}</ul>
  </section>);
}
