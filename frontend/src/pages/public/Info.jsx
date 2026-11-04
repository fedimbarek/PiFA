import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApi, useTitle } from '../../hooks/useApi.js';
import { api } from '../../lib/api.js';
import { contactSchema } from '../../lib/validation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { applyServerErrors, ErrorSummary, Loading, PageHeader, TextField, ErrorState } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';
import { MapView } from '../../components/MapView.jsx';
import { formatShort } from '../../lib/format.js';

export function About() {
  useTitle('À propos');
  return (
    <>
      <PageHeader title="À propos d'InclusiVenue" eyebrow="Notre démarche" crumbs={[{ label: 'Accueil', to: '/' }, { label: 'À propos' }]} />
      <div className="container prose">
        <p style={{ fontSize: 'var(--fs-lg)' }}>
          InclusiVenue met en relation les associations et organisateurs culturels avec tous les publics, y compris les personnes en situation de handicap visuel, moteur, auditif ou cognitif.
        </p>
        <h2>Pourquoi cette plateforme ?</h2>
        <p>
          Trop souvent, savoir si un spectacle est interprété en langue des signes ou si une salle est accessible en fauteuil demande plusieurs appels. InclusiVenue rend ces informations visibles, filtrables et fiables, au moment de choisir.
        </p>
        <h2>Ce que nous proposons</h2>
        <ul>
          <li>Une recherche par service d'accessibilité : langue des signes, boucle magnétique, audiodescription, sous-titrage, accès fauteuil, transport adapté, espace calme, documents FALC ou braille.</li>
          <li>La réservation de places avec signalement des besoins à l'organisateur.</li>
          <li>Des préférences d'affichage enregistrées sur votre compte : taille du texte, contraste élevé, réduction des animations, lecture facilitée.</li>
          <li>Une carte interactive accessible des lieux, toujours accompagnée d'une liste textuelle.</li>
          <li>L'ajout de vos réservations à votre agenda (export iCal) et des rappels la veille.</li>
        </ul>
        <h2>Pour les organisateurs</h2>
        <p>
          Les associations publient leurs événements, gèrent leurs jauges et suivent la fréquentation. Chaque publication est relue par l'équipe de modération pour garantir la qualité des informations d'accessibilité.
        </p>
        <p>
          <Link to="/inscription?role=organizer" className="btn">Devenir organisateur</Link>
        </p>
      </div>
    </>
  );
}

export function Contact() {
  useTitle('Contact');
  const { user } = useAuth();
  const toast = useToast();
  const [sent, setSent] = useState(null);
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting, submitCount } } = useForm({
    resolver: zodResolver(contactSchema),
    shouldFocusError: false,
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });
  const onSubmit = async (v) => {
    try {
      const r = await api.post('/contact', v);
      setSent(r.message);
      toast.success(r.message);
      reset({ name: v.name, email: v.email, subject: '', message: '' });
    } catch (e) {
      applyServerErrors(e, setError);
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Contact" eyebrow="Une question ?" intro="Besoin d'aide pour réserver, signaler un problème d'accessibilité ou devenir partenaire : écrivez-nous." crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Contact' }]} />
      <div className="container grid-2">
        <form className="panel form" noValidate onSubmit={handleSubmit(onSubmit, () => setTimeout(() => document.getElementById('error-summary')?.focus(), 0))} aria-labelledby="contact-form-title">
          <h2 id="contact-form-title">Envoyer un message</h2>
          {submitCount > 0 && <ErrorSummary errors={errors} />}
          {sent && <p className="alert alert--success" role="status">{sent}</p>}
          <TextField id="f-name" label="Nom" autoComplete="name" required error={errors.name?.message} {...register('name')} />
          <TextField id="f-email" label="Adresse e-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <TextField id="f-subject" label="Objet" required error={errors.subject?.message} {...register('subject')} />
          <TextField id="f-message" as="textarea" label="Message" rows={6} required error={errors.message?.message} {...register('message')} />
          <button type="submit" className="btn" disabled={isSubmitting}>
            <Icon name="send" /> {isSubmitting ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
        <div className="stack">
          <div className="card">
            <h2 style={{ fontSize: 'var(--fs-xl)' }}>Autres moyens de nous joindre</h2>
            <p>Nous répondons sous 2 jours ouvrés. Si vous ne pouvez pas utiliser le formulaire, vous pouvez aussi demander à un proche de nous écrire en votre nom.</p>
          </div>
          <div className="card">
            <h2 style={{ fontSize: 'var(--fs-xl)' }}>Signaler un défaut d'accessibilité</h2>
            <p>Un contenu ou une fonctionnalité ne vous est pas accessible ? Décrivez la page et le problème : nous vous fournirons l'information par un autre moyen et corrigerons le défaut.</p>
            <Link to="/accessibilite">Déclaration d'accessibilité</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function AccessibilityStatement() {
  useTitle("Déclaration d'accessibilité");
  return (
    <>
      <PageHeader title="Déclaration d'accessibilité" eyebrow="Engagement" crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Accessibilité' }]} />
      <div className="container prose">
        <p>
          InclusiVenue s'engage à rendre son service accessible conformément aux Règles pour l'accessibilité des contenus Web (WCAG) 2.1 niveau AA, en s'appuyant sur le référentiel RGAA.
        </p>
        <h2>État de conformité</h2>
        <p>
          Le site est <strong>partiellement conforme</strong> aux WCAG 2.1 AA. Cette déclaration s'appuie sur des tests automatisés et manuels menés par l'équipe projet ; aucun audit indépendant n'a encore été réalisé. Le détail des tests figure dans le rapport d'audit du projet.
        </p>
        <h2>Ce qui a été mis en œuvre</h2>
        <ul>
          <li>Navigation complète au clavier, lien d'évitement vers le contenu, indicateurs de focus visibles.</li>
          <li>Structure sémantique (en-tête, navigation, contenu principal, pied de page) et hiérarchie de titres cohérente.</li>
          <li>Formulaires avec étiquettes, aide et messages d'erreur associés et annoncés, récapitulatif des erreurs.</li>
          <li>Contrastes de texte d'au moins 4,5:1, mode contraste élevé, texte agrandissable jusqu'à 200 %.</li>
          <li>Réduction des animations, lecture facilitée, mode lecteur d'écran et mode sourd/malentendant.</li>
          <li>Fenêtres de dialogue accessibles (focus piégé, fermeture par Échap), notifications annoncées.</li>
          <li>Carte interactive accompagnée d'une liste textuelle équivalente ; lecture vocale des descriptions.</li>
        </ul>
        <h2>Limites connues</h2>
        <ul>
          <li>Les fonds de carte OpenStreetMap ne disposent pas d'alternative textuelle détaillée : utilisez la liste des lieux.</li>
          <li>Les textes alternatifs des images dépendent des organisateurs ; ils sont relus lors de la modération.</li>
          <li>Les tests avec lecteurs d'écran (NVDA, VoiceOver) doivent être complétés par des utilisateurs réels.</li>
        </ul>
        <h2>Retour d'information et contact</h2>
        <p>
          Si vous ne pouvez pas accéder à un contenu ou à un service, <Link to="/contact">contactez-nous</Link> : nous vous orienterons vers une alternative accessible.
        </p>
        <h2>Voies de recours</h2>
        <p>Si vous n'obtenez pas de réponse satisfaisante, vous pouvez saisir les instances compétentes en matière de droits des personnes handicapées.</p>
      </div>
    </>
  );
}

export function MapPage() {
  useTitle('Carte des lieux');
  const { data, error, loading, reload } = useApi('/events/map');
  const [selected, setSelected] = useState(null);
  return (
    <>
      <PageHeader
        title="Carte des lieux"
        eyebrow="Fonctionnalité accessible"
        intro="Repérez les événements près de chez vous. La carte se parcourt au clavier ; la liste ci-dessous présente les mêmes informations."
        crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Carte' }]}
      />
      <div className="container stack">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <Loading />
        ) : (
          <>
            <MapView events={data.items} selectedId={selected} onSelect={setSelected} />
            <section aria-labelledby="venues-title">
              <h2 id="venues-title">Liste des lieux ({data.items.length})</h2>
              <ul className="card-grid">
                {data.items.map((e) => (
                  <li key={e.id} className="card" aria-current={selected === e.id ? 'true' : undefined}>
                    <h3 style={{ fontSize: 'var(--fs-lg)' }}>
                      <Link to={`/evenements/${e.id}`}>{e.title}</Link>
                    </h3>
                    <p className="small muted" style={{ marginBottom: 'var(--sp-2)' }}>
                      {formatShort(e.startDate)}
                    </p>
                    <address style={{ fontStyle: 'normal' }}>
                      {e.venue.name}
                      <br />
                      {e.venue.address}, {e.venue.city}
                    </address>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setSelected(e.id); document.querySelector('.iv-map')?.scrollIntoView({ block: 'center' }); }}>
                      <Icon name="map" size={18} /> Voir sur la carte<span className="sr-only"> : {e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

export function Sitemap() {
  useTitle('Plan du site');
  const { user } = useAuth();
  const groups = [
    ['Découvrir', [['/', 'Accueil'], ['/evenements', 'Événements'], ['/carte', 'Carte des lieux'], ['/a-propos', 'À propos'], ['/contact', 'Contact'], ['/accessibilite', "Déclaration d'accessibilité"]]],
    ['Compte', user ? [['/mon-espace', 'Mon espace'], ['/mon-espace/reservations', 'Mes réservations'], ['/mon-espace/notifications', 'Notifications'], ['/mon-espace/profil', 'Profil'], ['/mon-espace/accessibilite', "Réglages d'accessibilité"]] : [['/connexion', 'Connexion'], ['/inscription', 'Inscription'], ['/mot-de-passe-oublie', 'Mot de passe oublié']]],
  ];
  if (user && user.role !== 'user') groups.push(['Organisateur', [['/organisateur', 'Tableau de bord'], ['/organisateur/evenements', 'Mes événements'], ['/organisateur/evenements/nouveau', 'Créer un événement'], ['/organisateur/statistiques', 'Statistiques']]]);
  if (user?.role === 'admin') groups.push(['Administration', [['/admin', 'Tableau de bord'], ['/admin/utilisateurs', 'Utilisateurs'], ['/admin/moderation', 'Modération'], ['/admin/statistiques', 'Statistiques'], ['/admin/parametres', 'Paramètres']]]);
  return (
    <>
      <PageHeader title="Plan du site" crumbs={[{ label: 'Accueil', to: '/' }, { label: 'Plan du site' }]} />
      <div className="container grid-2">
        {groups.map(([title, links]) => (
          <section key={title} className="card">
            <h2 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h2>
            <ul>
              {links.map(([to, l]) => (
                <li key={to}><Link to={to}>{l}</Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export function NotFound() {
  useTitle('Page introuvable');
  return (
    <div className="container section center">
      <span className="eyebrow">Erreur 404</span>
      <h1>Page introuvable</h1>
      <p className="muted">La page demandée n'existe pas ou a été déplacée.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn">Retour à l'accueil</Link>
        <Link to="/evenements" className="btn btn--secondary">Voir les événements</Link>
      </div>
    </div>
  );
}
