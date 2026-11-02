import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import routes from './routes.js';

const ok = { responses: { 200: { description: 'OK' } } };
const spec = { openapi: '3.0.0', info: { title: 'InclusiVenue API', version: '1.0.0' },
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/api/auth/register': { post: { summary: 'Créer un compte', ...ok } },
    '/api/auth/login': { post: { summary: 'Se connecter (JWT)', ...ok } },
    '/api/events': { get: { summary: 'Lister/filtrer (q, accessibility, free, from, sort, page)', ...ok }, post: { summary: 'Créer un événement', security: [{ bearer: [] }], ...ok } },
    '/api/events/{id}/book': { post: { summary: 'Réserver (quota atomique)', security: [{ bearer: [] }], ...ok } },
    '/api/bookings/mine/calendar.ics': { get: { summary: 'Export iCal', security: [{ bearer: [] }], ...ok } },
    '/api/admin/stats': { get: { summary: 'Statistiques globales', security: [{ bearer: [] }], ...ok } } } };

const app = express();
app.use(helmet(), compression(), cors({ origin: process.env.CLIENT_URL || true }), express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api-docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(spec));
app.use('/api', routes);
app.use((err, _req, res, _next) => { console.error(err); const v = err.name === 'ValidationError'; res.status(v ? 400 : 500).json({ error: v ? err.message : 'Erreur serveur.' }); });
export default app;
