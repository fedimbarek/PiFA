import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { homeForRole, useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useTitle } from '../../hooks/useApi.js';
import { api } from '../../lib/api.js';
import { forgotSchema, loginSchema, registerSchema, resetSchema } from '../../lib/validation.js';
import { applyServerErrors, Checkbox, ErrorSummary, TextField } from '../../components/ui.jsx';
import { Icon } from '../../components/Icon.jsx';

/** After an invalid submit, move focus to the error summary (WCAG 3.3.1). */
const focusSummary = () => setTimeout(() => document.getElementById('error-summary')?.focus(), 0);

function AuthCard({ title, intro, children }) {
  return (
    <div className="container">
      <div className="auth-wrap panel">
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
      </div>
    </div>
  );
}

function PasswordField({ registration, error, label = 'Mot de passe', id, hint, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <TextField id={id} label={label} type={show ? 'text' : 'password'} required error={error} hint={hint} autoComplete={autoComplete} {...registration} />
      <label className="check small" style={{ minHeight: 'auto' }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Afficher le mot de passe
      </label>
    </div>
  );
}

export function Login() {
  useTitle('Connexion');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting, submitCount } } = useForm({ resolver: zodResolver(loginSchema), shouldFocusError: false });

  const onSubmit = async (v) => {
    setServerError(null);
    try {
      const user = await login(v.email, v.password);
      toast.success(`Bienvenue, ${user.name.split(' ')[0]} !`);
      navigate(location.state?.from || homeForRole(user.role), { replace: true });
    } catch (e) {
      setServerError(e.message);
    }
  };

  return (
    <AuthCard title="Connexion" intro="Accédez à vos réservations, notifications et préférences d'accessibilité.">
      <form className="form" noValidate onSubmit={handleSubmit(onSubmit, focusSummary)}>
        {submitCount > 0 && <ErrorSummary errors={errors} />}
        {serverError && (
          <p className="alert alert--error" role="alert">
            <Icon name="alert" /> {serverError}
          </p>
        )}
        <TextField id="f-email" label="Adresse e-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <PasswordField id="f-password" registration={register('password')} error={errors.password?.message} autoComplete="current-password" />
        <button type="submit" className="btn btn--block" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <div className="row-between small" style={{ marginTop: 'var(--sp-4)' }}>
        <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        <Link to="/inscription" state={location.state}>Créer un compte</Link>
      </div>
      <details style={{ marginTop: 'var(--sp-4)' }}>
        <summary>Comptes de démonstration</summary>
        <p className="small">Mot de passe : <code>Password123</code></p>
        <ul className="small">
          <li>Participant : user@inclusivenue.tn</li>
          <li>Organisateur : orga@inclusivenue.tn</li>
          <li>Administrateur : admin@inclusivenue.tn</li>
        </ul>
      </details>
    </AuthCard>
  );
}

const REG_LABELS = { name: 'Nom', email: 'E-mail', password: 'Mot de passe', confirm: 'Confirmation', organizationName: 'Association', acceptTerms: 'Conditions' };

export function Register() {
  useTitle('Inscription');
  const { register: signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting, submitCount } } = useForm({
    resolver: zodResolver(registerSchema),
    shouldFocusError: false,
    defaultValues: { role: sp.get('role') === 'organizer' ? 'organizer' : 'user', acceptTerms: false },
  });
  const role = watch('role');

  const onSubmit = async ({ confirm: _c, ...v }) => {
    setServerError(null);
    try {
      const user = await signup({ ...v, organizationName: v.role === 'organizer' ? v.organizationName : undefined });
      toast.success('Votre compte a été créé. Bienvenue sur InclusiVenue !');
      navigate(location.state?.from || (user.role === 'organizer' ? '/organisateur' : '/mon-espace/accessibilite'), { replace: true });
    } catch (e) {
      applyServerErrors(e, setError);
      setServerError(e.message);
      focusSummary();
    }
  };

  return (
    <AuthCard title="Créer un compte" intro="Gratuit. Les champs marqués d'un astérisque (*) sont obligatoires.">
      <form className="form" noValidate onSubmit={handleSubmit(onSubmit, focusSummary)}>
        {submitCount > 0 && <ErrorSummary errors={errors} labels={REG_LABELS} />}
        {serverError && !Object.keys(errors).length && (
          <p className="alert alert--error" role="alert">
            {serverError}
          </p>
        )}
        <fieldset>
          <legend>Je souhaite</legend>
          <label className="check">
            <input type="radio" value="user" {...register('role')} /> <span>Découvrir et réserver des événements <span className="hint" style={{ display: 'block' }}>Compte participant</span></span>
          </label>
          <label className="check">
            <input type="radio" value="organizer" {...register('role')} /> <span>Publier les événements de mon association <span className="hint" style={{ display: 'block' }}>Compte organisateur — les événements sont validés par l&rsquo;équipe avant publication</span></span>
          </label>
        </fieldset>
        <TextField id="f-name" label="Nom complet" autoComplete="name" required error={errors.name?.message} {...register('name')} />
        {role === 'organizer' && <TextField id="f-organizationName" label="Nom de l'association ou de la structure" autoComplete="organization" required error={errors.organizationName?.message} {...register('organizationName')} />}
        <TextField id="f-email" label="Adresse e-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <PasswordField id="f-password" registration={register('password')} error={errors.password?.message} autoComplete="new-password" hint="8 caractères minimum, avec une majuscule, une minuscule et un chiffre." />
        <TextField id="f-confirm" label="Confirmer le mot de passe" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
        <Checkbox id="f-acceptTerms" label={<>J&rsquo;accepte les conditions d&rsquo;utilisation et la <Link to="/accessibilite">politique d&rsquo;accessibilité</Link>.</>} error={errors.acceptTerms?.message} {...register('acceptTerms')} />
        <button type="submit" className="btn btn--block" disabled={isSubmitting}>
          {isSubmitting ? 'Création du compte…' : 'Créer mon compte'}
        </button>
      </form>
      <p className="small" style={{ marginTop: 'var(--sp-4)' }}>
        Déjà inscrit(e) ? <Link to="/connexion" state={location.state}>Se connecter</Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPassword() {
  useTitle('Mot de passe oublié');
  const [done, setDone] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotSchema) });
  const onSubmit = async (v) => {
    const r = await api.post('/auth/forgot-password', v).catch((e) => ({ message: e.message }));
    setDone(r.message);
  };
  return (
    <AuthCard title="Mot de passe oublié" intro="Indiquez votre adresse e-mail : vous recevrez un lien valable une heure.">
      {done ? (
        <div className="alert alert--success" role="status">
          <Icon name="mail" /> <p style={{ margin: 0 }}>{done}</p>
        </div>
      ) : (
        <form className="form" noValidate onSubmit={handleSubmit(onSubmit)}>
          <TextField id="f-email" label="Adresse e-mail" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <button className="btn btn--block" type="submit" disabled={isSubmitting}>
            Envoyer le lien
          </button>
        </form>
      )}
      <p className="small" style={{ marginTop: 'var(--sp-4)' }}>
        <Link to="/connexion">Retour à la connexion</Link>
      </p>
    </AuthCard>
  );
}

export function ResetPassword() {
  useTitle('Nouveau mot de passe');
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) });
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/i.test(token)) setServerError('Ce lien est incomplet ou invalide. Faites une nouvelle demande.');
  }, [token]);
  const onSubmit = async (v) => {
    try {
      const r = await api.post('/auth/reset-password', { token, password: v.password });
      toast.success(r.message);
      navigate('/connexion');
    } catch (e) {
      setServerError(e.message);
    }
  };
  return (
    <AuthCard title="Choisir un nouveau mot de passe">
      {serverError && (
        <p className="alert alert--error" role="alert">
          {serverError} <Link to="/mot-de-passe-oublie">Nouvelle demande</Link>
        </p>
      )}
      <form className="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <PasswordField id="f-password" label="Nouveau mot de passe" registration={register('password')} error={errors.password?.message} autoComplete="new-password" hint="8 caractères minimum, avec une majuscule, une minuscule et un chiffre." />
        <TextField id="f-confirm" label="Confirmer" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
        <button className="btn btn--block" type="submit" disabled={isSubmitting || !token}>
          Enregistrer
        </button>
      </form>
    </AuthCard>
  );
}
