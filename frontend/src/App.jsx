import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout, RequireAuth } from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Home from './pages/public/Home.jsx';

// Route-level code splitting: each space is downloaded only when visited.
const Events = lazy(() => import('./pages/public/Events.jsx'));
const EventDetail = lazy(() => import('./pages/public/EventDetail.jsx'));
const auth = () => import('./pages/public/Auth.jsx');
const info = () => import('./pages/public/Info.jsx');
const user = () => import('./pages/user/User.jsx');
const orga = () => import('./pages/organizer/Organizer.jsx');
const admin = () => import('./pages/admin/Admin.jsx');
const pick = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const Login = pick(auth, 'Login');
const Register = pick(auth, 'Register');
const ForgotPassword = pick(auth, 'ForgotPassword');
const ResetPassword = pick(auth, 'ResetPassword');
const About = pick(info, 'About');
const Contact = pick(info, 'Contact');
const AccessibilityStatement = pick(info, 'AccessibilityStatement');
const MapPage = pick(info, 'MapPage');
const Sitemap = pick(info, 'Sitemap');
const NotFound = pick(info, 'NotFound');
const UserDashboard = pick(user, 'UserDashboard');
const Bookings = pick(user, 'Bookings');
const Notifications = pick(user, 'Notifications');
const Profile = pick(user, 'Profile');
const AccessibilitySettings = pick(user, 'AccessibilitySettings');
const OrganizerDashboard = pick(orga, 'OrganizerDashboard');
const MyEvents = pick(orga, 'MyEvents');
const EventForm = pick(orga, 'EventForm');
const Reservations = pick(orga, 'Reservations');
const OrganizerStats = pick(orga, 'OrganizerStats');
const AdminDashboard = pick(admin, 'AdminDashboard');
const Moderation = pick(admin, 'Moderation');
const Users = pick(admin, 'Users');
const AdminStats = pick(admin, 'AdminStats');
const AdminSettings = pick(admin, 'AdminSettings');

const ORG = ['organizer', 'admin'];
const guard = (el, roles) => <RequireAuth roles={roles}>{el}</RequireAuth>;

export default function App() {
  return (
    <Suspense fallback={<div className="container section"><Loading /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="evenements" element={<Events />} />
          <Route path="evenements/:id" element={<EventDetail />} />
          <Route path="carte" element={<MapPage />} />
          <Route path="connexion" element={<Login />} />
          <Route path="inscription" element={<Register />} />
          <Route path="mot-de-passe-oublie" element={<ForgotPassword />} />
          <Route path="reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="a-propos" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="accessibilite" element={<AccessibilityStatement />} />
          <Route path="plan-du-site" element={<Sitemap />} />

          <Route path="mon-espace" element={guard(<UserDashboard />)} />
          <Route path="mon-espace/reservations" element={guard(<Bookings />)} />
          <Route path="mon-espace/notifications" element={guard(<Notifications />)} />
          <Route path="mon-espace/profil" element={guard(<Profile />)} />
          <Route path="mon-espace/accessibilite" element={guard(<AccessibilitySettings />)} />

          <Route path="organisateur" element={guard(<OrganizerDashboard />, ORG)} />
          <Route path="organisateur/evenements" element={guard(<MyEvents />, ORG)} />
          <Route path="organisateur/evenements/nouveau" element={guard(<EventForm />, ORG)} />
          <Route path="organisateur/evenements/:id/modifier" element={guard(<EventForm />, ORG)} />
          <Route path="organisateur/evenements/:id/reservations" element={guard(<Reservations />, ORG)} />
          <Route path="organisateur/statistiques" element={guard(<OrganizerStats />, ORG)} />

          <Route path="admin" element={guard(<AdminDashboard />, ['admin'])} />
          <Route path="admin/moderation" element={guard(<Moderation />, ['admin'])} />
          <Route path="admin/utilisateurs" element={guard(<Users />, ['admin'])} />
          <Route path="admin/statistiques" element={guard(<AdminStats />, ['admin'])} />
          <Route path="admin/parametres" element={guard(<AdminSettings />, ['admin'])} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
