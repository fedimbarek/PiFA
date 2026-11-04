import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { buildContainer } from './container.js';
import { createControllers } from './controllers/index.js';
import { createRoutes } from './routes/index.js';
import { requireCsrfHeader } from './middleware/auth.js';
import { sanitizeRequest, notFoundHandler, errorHandler } from './middleware/common.js';
import { openapi } from './docs/openapi.js';
import { dbState } from './config/db.js';

export function createApp(env, overrides = {}) {
  const container = buildContainer(env, overrides);
  const c = createControllers(container);
  const app = express();
  const logger = overrides.logger || console;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploaded images are displayed by the web origin
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"] },
      },
    }),
  );
  const origins = env.CLIENT_URL.split(',').map((s) => s.trim());
  app.use(cors({ origin: origins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  const limiterOpts = { standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans quelques minutes.' } } };
  const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.RATE_LIMIT_MAX, ...limiterOpts });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.AUTH_RATE_LIMIT_MAX, skipSuccessfulRequests: false, ...limiterOpts });
  const noLimit = (_req, _res, next) => next();

  const health = (_req, res) => {
    const db = dbState();
    res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) });
  };
  app.get('/health', health);
  app.get('/api/health', health);

  app.get('/api-docs.json', (_req, res) => res.json(openapi));
  app.use('/api-docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'InclusiVenue API' }));

  app.use(
    '/uploads',
    express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '30d', immutable: true, fallthrough: false, index: false }),
  );

  app.use('/api', env.NODE_ENV === 'test' ? noLimit : globalLimiter, sanitizeRequest, requireCsrfHeader);
  app.use('/api', createRoutes({ c, auth: container.auth, env, authLimiter: env.NODE_ENV === 'test' && !overrides.enableAuthLimiter ? noLimit : authLimiter }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  app.locals.container = container;
  return app;
}
